-- Enable RLS on the posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing SELECT policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
DROP POLICY IF EXISTS "Public posts are visible to everyone" ON public.posts;
DROP POLICY IF EXISTS "Followed private accounts posts visible" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts; -- Just in case an old one exists
DROP POLICY IF EXISTS "Blocked users cannot see each other's posts" ON public.posts; -- Just in case an old one exists
DROP POLICY IF EXISTS "Posts visibility based on private account setting" ON public.posts; -- Just in case an old one exists

-- Policy 1: Users can view their own posts
CREATE POLICY "Users can view their own posts" ON public.posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Authenticated users can view posts from public accounts if not blocked
CREATE POLICY "Authenticated can view public posts if not blocked" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the post creator is NOT a private account
    NOT EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
    AND
    -- Check if auth.uid() has NOT blocked the post creator, AND the post creator has NOT blocked auth.uid()
    NOT EXISTS (
      SELECT 1 FROM public.blocked_users 
      WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id) 
         OR (blocked_id = auth.uid() AND blocker_id = posts.user_id)
    )
  );

-- Policy 3: Authenticated users can view posts from private accounts they follow, if not blocked
CREATE POLICY "Authenticated can view followed private posts if not blocked" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the post creator IS a private account
    EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
    AND
    -- Check if auth.uid() follows the post creator
    EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.user_id)
    AND
    -- Check if auth.uid() has NOT blocked the post creator, AND the post creator has NOT blocked auth.uid()
    NOT EXISTS (
      SELECT 1 FROM public.blocked_users 
      WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id) 
         OR (blocked_id = auth.uid() AND blocker_id = posts.user_id)
    )
  );

-- Policy 4: Users can delete their own posts
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 5: Users can insert their own posts
CREATE POLICY "Users can insert their own posts" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 6: Users can update their own posts
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
