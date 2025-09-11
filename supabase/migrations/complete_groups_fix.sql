-- First, disable RLS temporarily to avoid conflicts
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they created" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;

DROP POLICY IF EXISTS "Users can view group members of groups they belong to" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Group creators and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators and admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can view all members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can update member roles" ON public.group_members;

DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.group_messages;

-- Re-enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies for groups
CREATE POLICY "groups_select_policy" ON public.groups
  FOR SELECT USING (
    created_by = auth.uid()
  );

CREATE POLICY "groups_insert_policy" ON public.groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "groups_update_policy" ON public.groups
  FOR UPDATE USING (created_by = auth.uid());

-- Create simple policies for group_members
CREATE POLICY "group_members_select_own" ON public.group_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "group_members_select_created_groups" ON public.group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_insert_policy" ON public.group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_update_policy" ON public.group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_delete_policy" ON public.group_members
  FOR DELETE USING (user_id = auth.uid());

-- Create simple policies for group_messages
CREATE POLICY "group_messages_select_policy" ON public.group_messages
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "group_messages_insert_policy" ON public.group_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "group_messages_update_policy" ON public.group_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "group_messages_delete_policy" ON public.group_messages
  FOR DELETE USING (sender_id = auth.uid());
