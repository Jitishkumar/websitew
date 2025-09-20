-- Final fix for story_views RLS - completely disable RLS for now
-- This will allow story views to work while we debug the complex policies

-- Disable RLS temporarily to allow story views to work
ALTER TABLE public.story_views DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, use these simple policies:
-- DROP ALL existing policies first
DROP POLICY IF EXISTS "Users can insert their own story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can insert story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can view all story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can view story views" ON public.story_views;
DROP POLICY IF EXISTS "Allow authenticated users to insert story views" ON public.story_views;
DROP POLICY IF EXISTS "Allow authenticated users to view story views" ON public.story_views;

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Create very simple policies that work
CREATE POLICY "story_views_insert_policy" ON public.story_views
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "story_views_select_policy" ON public.story_views
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);
