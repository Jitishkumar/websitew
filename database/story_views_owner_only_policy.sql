-- Create RLS policy so only story owners can see who viewed their stories
-- This adds an extra layer of security at the database level

-- Drop existing policies
DROP POLICY IF EXISTS "story_views_insert_policy" ON public.story_views;
DROP POLICY IF EXISTS "story_views_select_policy" ON public.story_views;

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert story views (when they view a story)
CREATE POLICY "Anyone can insert story views" ON public.story_views
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Only story owners can see who viewed their stories
CREATE POLICY "Only story owners can see story viewers" ON public.story_views
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- This ensures:
-- 1. Anyone can mark a story as viewed (INSERT)
-- 2. Only the story owner can see who viewed their story (SELECT)
