-- Temporarily disable RLS on public.posts to drop policies cleanly
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing SELECT policies to prevent conflicts, keeping other policies (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated can view public posts if not blocked" ON public.posts;
DROP POLICY IF EXISTS "Authenticated can view followed private posts if not blocked" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can view all posts unless blocked" ON public.posts;
DROP POLICY IF EXISTS "Users can view posts with privacy and block checks" ON public.posts;

-- Re-enable RLS on public.posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create a comprehensive SELECT policy: Users can view their own posts, public posts (if not blocked),
-- or private posts from users they follow (if not blocked).
CREATE POLICY "Users can view posts based on privacy, follow status, and block status" ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    -- Condition 1: User can view their own posts
    (auth.uid() = posts.user_id)
    OR
    (
        -- Condition 2: Authenticated user can view public posts if not blocked
        -- Check if the post owner's account is NOT private
        NOT EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
        AND
        -- Check if there is NO blocking relationship (current user blocked owner, or owner blocked current user)
        NOT EXISTS (
            SELECT 1 FROM public.blocked_users
            WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
               OR (blocked_id = auth.uid() AND blocker_id = posts.user_id)
        )
    )
    OR
    (
        -- Condition 3: Authenticated user can view private posts if they follow the owner AND are not blocked
        -- Check if the post owner's account IS private
        EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = posts.user_id AND private_account = TRUE)
        AND
        -- Check if the current user follows the post owner
        EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.user_id)
        AND
        -- Check if there is NO blocking relationship
        NOT EXISTS (
            SELECT 1 FROM public.blocked_users
            WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
               OR (blocked_id = auth.uid() AND blocker_id = posts.user_id)
        )
    )
);
