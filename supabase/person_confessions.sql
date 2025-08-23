-- Create the table for person profiles
CREATE TABLE public.person_profiles (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  profile_image text NULL,
  bio text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(), -- Added updated_at column
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT person_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT person_profiles_name_key UNIQUE (name)
);
ALTER TABLE public.person_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.person_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create person profiles." ON public.person_profiles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own person profiles." ON public.person_profiles FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own person profiles." ON public.person_profiles FOR DELETE USING (auth.uid() = created_by);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for person_profiles table
CREATE TRIGGER update_person_profiles_updated_at
BEFORE UPDATE ON public.person_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create the table for person confessions
CREATE TABLE public.person_confessions (
  id serial NOT NULL,
  person_id uuid NOT NULL REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  user_id uuid NULL, -- Can be null if anonymous
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NULL,
  media jsonb NULL,
  is_anonymous boolean NULL DEFAULT true,
  likes_count integer NULL DEFAULT 0,
  comments_count integer NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT person_confessions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.person_confessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View person confessions for authenticated and public non-anonymous" ON public.person_confessions FOR SELECT USING (auth.role() = 'authenticated' OR (auth.role() = 'anon' AND is_anonymous = FALSE) OR auth.uid() = creator_id);
CREATE POLICY "Users can create person confessions." ON public.person_confessions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own person confessions." ON public.person_confessions FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own person confessions." ON public.person_confessions FOR DELETE USING (auth.uid() = creator_id);

-- Create table for person confession likes
CREATE TABLE public.person_confession_likes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  confession_id integer NOT NULL REFERENCES public.person_confessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT person_confession_likes_pkey PRIMARY KEY (id),
  CONSTRAINT unique_person_confession_like UNIQUE (confession_id, user_id)
);
ALTER TABLE public.person_confession_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can like person confessions." ON public.person_confession_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see person confession likes." ON public.person_confession_likes FOR SELECT USING (true);
CREATE POLICY "Users can unlike their own person confessions." ON public.person_confession_likes FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update person_confessions.likes_count
CREATE FUNCTION public.update_person_confession_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.person_confessions
    SET likes_count = likes_count + 1
    WHERE id = NEW.confession_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.person_confessions
    SET likes_count = likes_count - 1
    WHERE id = OLD.confession_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_person_confession_likes_count_trigger
AFTER INSERT OR DELETE ON public.person_confession_likes
FOR EACH ROW EXECUTE FUNCTION public.update_person_confession_likes_count();

-- Create table for person confession comments
CREATE TABLE public.person_confession_comments (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  confession_id integer NOT NULL REFERENCES public.person_confessions(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Allow null for anonymous comments
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Changed to public.profiles(id)
  content text NOT NULL,
  parent_comment_id uuid NULL REFERENCES public.person_confession_comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_anonymous boolean NULL DEFAULT false,
  CONSTRAINT person_confession_comments_pkey PRIMARY KEY (id)
);
ALTER TABLE public.person_confession_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create person confession comments."
  ON public.person_confession_comments FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND NOT is_anonymous) OR
    (auth.uid() = creator_id AND is_anonymous)
  );
CREATE POLICY "Users can view person confession comments." ON public.person_confession_comments FOR SELECT USING (true);
CREATE POLICY "Users can delete their own person confession comments." ON public.person_confession_comments FOR DELETE USING (auth.uid() = creator_id);

-- Trigger to update person_confessions.comments_count
CREATE FUNCTION public.update_person_confession_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.person_confessions
    SET comments_count = comments_count + 1
    WHERE id = NEW.confession_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.person_confessions
    SET comments_count = comments_count - 1
    WHERE id = OLD.confession_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_person_confession_comments_count_trigger
AFTER INSERT OR DELETE ON public.person_confession_comments
FOR EACH ROW EXECUTE FUNCTION public.update_person_confession_comments_count();

-- Create table for person confession reactions
CREATE TABLE public.person_confession_reactions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  confession_id integer NOT NULL REFERENCES public.person_confessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT person_confession_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT unique_person_confession_reaction UNIQUE (confession_id, user_id)
);
ALTER TABLE public.person_confession_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can react to person confessions." ON public.person_confession_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see person confession reactions." ON public.person_confession_reactions FOR SELECT USING (true);
CREATE POLICY "Users can remove their person confession reactions." ON public.person_confession_reactions FOR DELETE USING (auth.uid() = user_id);

-- Create table for person confession verifications
CREATE TABLE public.person_confession_verifications (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  confession_id integer NOT NULL REFERENCES public.person_confessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT person_confession_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT unique_person_confession_verification UNIQUE (confession_id, user_id)
);
ALTER TABLE public.person_confession_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can verify person confessions." ON public.person_confession_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see person confession verifications." ON public.person_confession_verifications FOR SELECT USING (true);
CREATE POLICY "Users can update their person confession verifications." ON public.person_confession_verifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their person confession verifications." ON public.person_confession_verifications FOR DELETE USING (auth.uid() = user_id);
