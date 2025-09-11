-- Add views column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;

-- Create index for views column for better performance when sorting by views
CREATE INDEX IF NOT EXISTS idx_posts_views ON public.posts USING btree (views DESC);

-- Update existing posts to have 0 views if they don't have a value
UPDATE public.posts SET views = 0 WHERE views IS NULL;
