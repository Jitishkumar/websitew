-- --- DANGER ZONE: DROP EXISTING TABLES AND POLICIES ---
-- Only run these DROP statements if you are certain you want to remove existing data and schema for person confessions.

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS increment_person_confession_likes_count ON public.person_confessions;
DROP FUNCTION IF EXISTS public.increment_person_confession_likes_count();
DROP TRIGGER IF EXISTS increment_person_confession_comments_count ON public.person_confessions;
DROP FUNCTION IF EXISTS public.increment_person_confession_comments_count();

-- Drop RLS policies for all person confession related tables
DROP POLICY IF EXISTS "Authenticated users can manage their own person confession verifications" ON public.person_confession_verifications;
DROP POLICY IF EXISTS "Authenticated users can read person confession verifications" ON public.person_confession_verifications;

DROP POLICY IF EXISTS "Authenticated users can manage their own person confession reactions" ON public.person_confession_reactions;
DROP POLICY IF EXISTS "Authenticated users can read person confession reactions" ON public.person_confession_reactions;

DROP POLICY IF EXISTS "Authenticated users can manage their own person confession likes" ON public.person_confession_likes;
DROP POLICY IF EXISTS "Authenticated users can read person confession likes" ON public.person_confession_likes;

DROP POLICY IF EXISTS "Authenticated users can create person confession comments" ON public.person_confession_comments;
DROP POLICY IF EXISTS "Creators can delete their own person confession comments" ON public.person_confession_comments;
DROP POLICY IF EXISTS "Creators can update their own person confession comments" ON public.person_confession_comments;
DROP POLICY IF EXISTS "Authenticated users can read person confession comments" ON public.person_confession_comments;

DROP POLICY IF EXISTS "Authenticated users can create person confessions" ON public.person_confessions;
DROP POLICY IF EXISTS "Creators can delete their own person confessions" ON public.person_confessions;
DROP POLICY IF EXISTS "Creators can update their own person confessions" ON public.person_confessions;
DROP POLICY IF EXISTS "Authenticated users can read person confessions" ON public.person_confessions;

DROP POLICY IF EXISTS "Authenticated users can create person profiles" ON public.person_profiles;
DROP POLICY IF EXISTS "Creators can delete their own person profiles" ON public.person_profiles;
DROP POLICY IF EXISTS "Authenticated users can update person profiles" ON public.person_profiles; -- Updated policy name
DROP POLICY IF EXISTS "Authenticated users can read person profiles" ON public.person_profiles;


-- Drop tables in reverse dependency order (CASCADE is used for foreign key constraints)
DROP TABLE IF EXISTS public.person_confession_verifications CASCADE;
DROP TABLE IF EXISTS public.person_confession_reactions CASCADE;
DROP TABLE IF EXISTS public.person_confession_likes CASCADE;
DROP TABLE IF EXISTS public.person_confession_comments CASCADE;
DROP TABLE IF EXISTS public.person_confessions CASCADE;
DROP TABLE IF EXISTS public.person_profiles CASCADE;

-- --- END DANGER ZONE ---


-- --- CREATE NEW TABLES AND POLICIES ---

-- Create the person_profiles table
-- This table stores information about individuals who are the subject of confessions.
-- It can either directly reference an existing user's profile (profiles.id) or exist independently.
CREATE TABLE public.person_profiles (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Can be a new UUID or an existing user's profile ID
  name text NOT NULL, -- The name of the person being confessed about
  profile_image text NULL, -- URL to the person's profile image (e.g., from Cloudinary)
  bio text NULL, -- A short description or bio about the person
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()), -- Added updated_at column
  created_by uuid NULL, -- The user who added this person (FK to auth.users.id)
  CONSTRAINT person_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT person_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Enable Row Level Security for person_profiles
ALTER TABLE public.person_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to read person profiles
CREATE POLICY "Authenticated users can read person profiles" ON public.person_profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- Policy to allow any authenticated user to update the profile_image and bio of a person profile
-- NOTE: This is a very permissive policy. Any logged-in user can edit these fields for ANY person profile.
-- If you need more restrictive control (e.g., only the creator, or specific roles), this policy needs adjustment.
CREATE POLICY "Authenticated users can update person profiles" ON public.person_profiles
FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (true); -- Allows anyone authenticated to update

-- Policy to allow creators to delete their own person profiles
CREATE POLICY "Creators can delete their own person profiles" ON public.person_profiles
FOR DELETE USING (auth.uid() = created_by);

-- Policy to allow authenticated users to create person profiles
CREATE POLICY "Authenticated users can create person profiles" ON public.person_profiles
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Create the person_confessions table
-- This table stores confessions made about individuals.
CREATE TABLE public.person_confessions (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  user_id uuid NULL, -- The user who made the confession (if not anonymous)
  creator_id uuid NOT NULL, -- The actual user who created the confession (always stored, FK to public.profiles.id)
  person_id uuid NOT NULL, -- The ID of the person being confessed about (FK to person_profiles.id)
  person_name text NULL, -- The name of the person at the time of confession (for display)
  content text NULL,
  media jsonb NULL, -- Array of media objects {url, type, publicId}
  is_anonymous boolean NULL DEFAULT true,
  likes_count integer NULL DEFAULT 0,
  comments_count integer NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT person_confessions_pkey PRIMARY KEY (id),
  CONSTRAINT person_confessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT person_confessions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT person_confessions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person_profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security for person_confessions
ALTER TABLE public.person_confessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to read person confessions
CREATE POLICY "Authenticated users can read person confessions" ON public.person_confessions
FOR SELECT USING (true);

-- Policy to allow creators to update their own person confessions
CREATE POLICY "Creators can update their own person confessions" ON public.person_confessions
FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- Policy to allow creators to delete their own person confessions
CREATE POLICY "Creators can delete their own person confessions" ON public.person_confessions
FOR DELETE USING (auth.uid() = creator_id);

-- Policy to allow authenticated users to create person confessions
CREATE POLICY "Authenticated users can create person confessions" ON public.person_confessions
FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Create the person_confession_comments table
CREATE TABLE public.person_confession_comments (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  confession_id bigint NOT NULL, -- FK to person_confessions.id
  user_id uuid NULL, -- User who made the comment (if not anonymous)
  creator_id uuid NOT NULL, -- Actual user who created the comment
  content text NOT NULL,
  parent_comment_id bigint NULL, -- For replies, FK to person_confession_comments.id
  is_anonymous boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT person_confession_comments_pkey PRIMARY KEY (id),
  CONSTRAINT person_confession_comments_confession_id_fkey FOREIGN KEY (confession_id) REFERENCES public.person_confessions (id) ON DELETE CASCADE,
  CONSTRAINT person_confession_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT person_confession_comments_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT person_confession_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.person_confession_comments (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security for person_confession_comments
ALTER TABLE public.person_confession_comments ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to read comments
CREATE POLICY "Authenticated users can read person confession comments" ON public.person_confession_comments
FOR SELECT USING (true);

-- Policy to allow creators to update their own comments
CREATE POLICY "Creators can update their own person confession comments" ON public.person_confession_comments
FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- Policy to allow creators to delete their own comments
CREATE POLICY "Creators can delete their own person confession comments" ON public.person_confession_comments
FOR DELETE USING (auth.uid() = creator_id);

-- Policy to allow authenticated users to create comments
CREATE POLICY "Authenticated users can create person confession comments" ON public.person_confession_comments
FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Create the person_confession_likes table
CREATE TABLE public.person_confession_likes (
  confession_id bigint NOT NULL, -- FK to person_confessions.id
  user_id uuid NOT NULL, -- FK to profiles.id
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT person_confession_likes_pkey PRIMARY KEY (confession_id, user_id),
  CONSTRAINT person_confession_likes_confession_id_fkey FOREIGN KEY (confession_id) REFERENCES public.person_confessions (id) ON DELETE CASCADE,
  CONSTRAINT person_confession_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security for person_confession_likes
ALTER TABLE public.person_confession_likes ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read likes
CREATE POLICY "Authenticated users can read person confession likes" ON public.person_confession_likes
FOR SELECT USING (true);

-- Policy to allow authenticated users to like/unlike confessions
CREATE POLICY "Authenticated users can manage their own person confession likes" ON public.person_confession_likes
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create the person_confession_reactions table
CREATE TABLE public.person_confession_reactions (
  confession_id bigint NOT NULL, -- FK to person_confessions.id
  user_id uuid NOT NULL, -- FK to profiles.id
  emoji text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT person_confession_reactions_pkey PRIMARY KEY (confession_id, user_id),
  CONSTRAINT person_confession_reactions_confession_id_fkey FOREIGN KEY (confession_id) REFERENCES public.person_confessions (id) ON DELETE CASCADE,
  CONSTRAINT person_confession_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security for person_confession_reactions
ALTER TABLE public.person_confession_reactions ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read reactions
CREATE POLICY "Authenticated users can read person confession reactions" ON public.person_confession_reactions
FOR SELECT USING (true);

-- Policy to allow authenticated users to manage their own reactions
CREATE POLICY "Authenticated users can manage their own person confession reactions" ON public.person_confession_reactions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create the person_confession_verifications table
CREATE TABLE public.person_confession_verifications (
  confession_id bigint NOT NULL, -- FK to person_confessions.id
  user_id uuid NOT NULL, -- FK to profiles.id
  is_correct boolean NOT NULL,
  created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT person_confession_verifications_pkey PRIMARY KEY (confession_id, user_id),
  CONSTRAINT person_confession_verifications_confession_id_fkey FOREIGN KEY (confession_id) REFERENCES public.person_confessions (id) ON DELETE CASCADE,
  CONSTRAINT person_confession_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security for person_confession_verifications
ALTER TABLE public.person_confession_verifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read verifications
CREATE POLICY "Authenticated users can read person confession verifications" ON public.person_confession_verifications
FOR SELECT USING (true);

-- Policy to allow authenticated users to manage their own verifications
CREATE POLICY "Authenticated users can manage their own person confession verifications" ON public.person_confession_verifications
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Optional: Add a trigger to update comments_count on person_confessions when comments are inserted/deleted
CREATE OR REPLACE FUNCTION public.increment_person_confession_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.person_confessions
    SET comments_count = comments_count + 1
    WHERE id = NEW.confession_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.person_confessions
    SET comments_count = comments_count - 1
    WHERE id = OLD.confession_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_person_confession_comments_count
AFTER INSERT OR DELETE ON public.person_confession_comments
FOR EACH ROW EXECUTE FUNCTION public.increment_person_confession_comments_count();

-- Optional: Add a trigger to update likes_count on person_confessions when likes are inserted/deleted
CREATE OR REPLACE FUNCTION public.increment_person_confession_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.person_confessions
    SET likes_count = likes_count + 1
    WHERE id = NEW.confession_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.person_confessions
    SET likes_count = likes_count - 1
    WHERE id = OLD.confession_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_person_confession_likes_count
AFTER INSERT OR DELETE ON public.person_confession_likes
FOR EACH ROW EXECUTE FUNCTION public.increment_person_confession_likes_count();