-- Add columns to stories table for sharing functionality

-- Add shared_from_user_id to track who originally posted the content
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS shared_from_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add shared_from_username for display purposes
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS shared_from_username text;

-- Add position and scale for resizable shared content
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS position_x float DEFAULT 0;

ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS position_y float DEFAULT 0;

ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS scale float DEFAULT 1;

-- Add caption column if it doesn't exist
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS caption text;

-- Create index for faster queries on shared stories
CREATE INDEX IF NOT EXISTS idx_stories_shared_from_user 
ON public.stories(shared_from_user_id) 
WHERE shared_from_user_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.stories.shared_from_user_id IS 'User ID of the original content creator when resharing';
COMMENT ON COLUMN public.stories.shared_from_username IS 'Username of the original content creator for display';
COMMENT ON COLUMN public.stories.position_x IS 'X position of shared content in story';
COMMENT ON COLUMN public.stories.position_y IS 'Y position of shared content in story';
COMMENT ON COLUMN public.stories.scale IS 'Scale/zoom level of shared content';
COMMENT ON COLUMN public.stories.caption IS 'Optional caption for the story';
