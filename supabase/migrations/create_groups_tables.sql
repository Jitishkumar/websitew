-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name varchar(100) NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles (id) ON DELETE CASCADE
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role varchar(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
  CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE
);

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  group_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text,
  media_url text,
  media_type varchar(20),
  message_type varchar(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  reply_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_messages_pkey PRIMARY KEY (id),
  CONSTRAINT group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
  CONSTRAINT group_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT group_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES group_messages (id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON public.group_messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages USING btree (created_at);

-- Enable Row Level Security
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups table
CREATE POLICY "Users can view groups they are members of" ON public.groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update groups" ON public.groups
  FOR UPDATE USING (
    id IN (
      SELECT group_id FROM public.group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for group_members table
CREATE POLICY "Users can view group members of groups they belong to" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Group creators and admins can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Group creators and admins can update member roles" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Users can leave groups" ON public.group_members
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for group_messages table
CREATE POLICY "Group members can view messages" ON public.group_messages
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON public.group_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON public.group_messages
  FOR DELETE USING (sender_id = auth.uid());

-- Function to ensure max 2 admins per group
CREATE OR REPLACE FUNCTION check_admin_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    IF (SELECT COUNT(*) FROM public.group_members 
        WHERE group_id = NEW.group_id AND role = 'admin') >= 2 THEN
      RAISE EXCEPTION 'A group can have maximum 2 admins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce admin limit
CREATE TRIGGER enforce_admin_limit
  BEFORE INSERT OR UPDATE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_admin_limit();

-- Function to automatically make group creator an admin
CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add creator as admin
CREATE TRIGGER add_creator_as_admin_trigger
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_admin();
