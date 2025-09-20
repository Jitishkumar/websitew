-- Safe RLS policy for story_views that allows proper functionality
-- This re-enables RLS with simple, secure policies

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Allow insert story views" ON public.story_views;
DROP POLICY IF EXISTS "Story owners can see viewers" ON public.story_views;

-- Policy 1: Allow authenticated users to insert their own story views
CREATE POLICY "Users can insert own story views" ON public.story_views
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow users to see story views for stories they own
CREATE POLICY "Users can see own story viewers" ON public.story_views
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_views.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Policy 3: Allow users to update/delete their own story views (optional)
CREATE POLICY "Users can manage own story views" ON public.story_views
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- This ensures:
-- 1. Users can only insert story views for themselves
-- 2. Users can only see who viewed their own stories
-- 3. Secure and follows best practices
