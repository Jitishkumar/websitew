-- Fix story views insertion issue
-- The problem is that the RLS policy is preventing users from inserting story views

-- Drop all existing policies
DROP POLICY IF EXISTS "story_views_insert_policy" ON public.story_views;
DROP POLICY IF EXISTS "story_views_select_policy" ON public.story_views;
DROP POLICY IF EXISTS "Only story owners can see story viewers" ON public.story_views;
DROP POLICY IF EXISTS "Anyone can insert story views" ON public.story_views;

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Simple policy: Allow authenticated users to insert story views
CREATE POLICY "Allow insert story views" ON public.story_views
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Only story owners can see who viewed their stories
CREATE POLICY "Story owners can see viewers" ON public.story_views
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Test the policies
-- This should work now:
-- INSERT INTO story_views (story_id, user_id) VALUES ('your-story-id', auth.uid());
