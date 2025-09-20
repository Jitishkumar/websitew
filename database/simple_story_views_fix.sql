-- Simple fix for story_views RLS error
-- Drop all existing policies and create simple ones

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can insert story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can view all story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can view story views" ON public.story_views;

-- Create simple policies that work
-- Allow users to insert story views for any story (authenticated users only)
CREATE POLICY "Allow authenticated users to insert story views" ON public.story_views
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view story views (authenticated users only)
CREATE POLICY "Allow authenticated users to view story views" ON public.story_views
  FOR SELECT 
  TO authenticated
  USING (true);

-- Make sure RLS is enabled
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
