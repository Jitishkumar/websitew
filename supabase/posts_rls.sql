-- Enable RLS on the posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict or need to be replaced
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts;
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
DROP POLICY IF EXISTS "Public posts are visible to everyone" ON public.posts;
DROP POLICY IF EXISTS "Followed private accounts posts visible" ON public.posts;
DROP POLICY IF EXISTS "Blocked users cannot see each other's posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;

-- Policy to allow users to view their own posts
CREATE POLICY "Users can view their own posts" ON public.posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow authenticated users to view public posts, unless blocked
CREATE POLICY "Public posts are visible to everyone" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
    AND
    NOT EXISTS (SELECT 1 FROM public.blocked_users WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id) OR (blocked_id = auth.uid() AND blocker_id = posts.user_id))
  );

-- Policy to allow authenticated users to view posts from private accounts they follow
CREATE POLICY "Followed private accounts posts visible" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
    AND
    EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.user_id)
    AND
    NOT EXISTS (SELECT 1 FROM public.blocked_users WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id) OR (blocked_id = auth.uid() AND blocker_id = posts.user_id))
  );

-- Policy to allow users to delete their own posts
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow users to insert their own posts
CREATE POLICY "Users can insert their own posts" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own posts
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
