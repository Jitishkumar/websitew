-- Temporarily disable RLS on public.posts to drop the policy cleanly
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;

-- Drop the existing problematic SELECT policy
DROP POLICY IF EXISTS "Users can view posts with privacy and block checks" ON public.posts;

-- Re-enable RLS on public.posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create a new SELECT policy to allow authenticated users to view all posts, unless there is a blocking relationship
CREATE POLICY "Authenticated users can view all posts unless blocked" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
         OR (blocked_id = auth.uid() AND blocker_id = posts.user_id)
    )
  );
