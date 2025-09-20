-- Fix story_views RLS policy to allow viewing any story
-- The current policy only allows users to insert their own views,
-- but users should be able to view any story (even if it's not theirs)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can insert their own story views" ON public.story_views;

-- Create a new policy that allows users to insert views for any story they can see
CREATE POLICY "Users can insert story views" ON public.story_views
  FOR INSERT 
  TO public
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id
      -- User can see the story (using the same logic as stories table)
      AND (
        (stories.followers_only = false) 
        OR (EXISTS (SELECT 1 FROM follows WHERE follows.following_id = stories.user_id AND follows.follower_id = auth.uid()))
        OR (stories.user_id = auth.uid())
        OR ((EXISTS (SELECT 1 FROM profiles WHERE profiles.id = stories.user_id AND profiles.rank = 1)) 
            AND (NOT (EXISTS (SELECT 1 FROM blocked_users WHERE blocked_users.blocker_id = stories.user_id AND blocked_users.blocked_id = auth.uid()))))
      )
    )
  );

-- Also add a SELECT policy for story_views
DROP POLICY IF EXISTS "Users can view all story views" ON public.story_views;

CREATE POLICY "Users can view story views" ON public.story_views
  FOR SELECT 
  TO public
  USING (
    -- Users can see views for stories they can access
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id
      AND (
        (stories.followers_only = false) 
        OR (EXISTS (SELECT 1 FROM follows WHERE follows.following_id = stories.user_id AND follows.follower_id = auth.uid()))
        OR (stories.user_id = auth.uid())
        OR ((EXISTS (SELECT 1 FROM profiles WHERE profiles.id = stories.user_id AND profiles.rank = 1)) 
            AND (NOT (EXISTS (SELECT 1 FROM blocked_users WHERE blocked_users.blocker_id = stories.user_id AND blocked_users.blocked_id = auth.uid()))))
      )
    )
  );
