-- Add fields for shared stories (Instagram-style story sharing)
-- This allows users to share posts to their story with positioning and attribution

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS shared_from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shared_from_username TEXT,
ADD COLUMN IF NOT EXISTS position_x FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS scale FLOAT DEFAULT 1;

-- Make cloudinary_public_id nullable for shared stories (media already uploaded)
ALTER TABLE stories 
ALTER COLUMN cloudinary_public_id DROP NOT NULL;

-- Add index for faster queries on shared stories
CREATE INDEX IF NOT EXISTS idx_stories_shared_from_user ON stories(shared_from_user_id);

-- Add comment to explain the new fields
COMMENT ON COLUMN stories.shared_from_user_id IS 'User ID of the original post author when story is a shared post';
COMMENT ON COLUMN stories.shared_from_username IS 'Username of the original post author for display';
COMMENT ON COLUMN stories.position_x IS 'X position of shared content in story canvas';
COMMENT ON COLUMN stories.position_y IS 'Y position of shared content in story canvas';
COMMENT ON COLUMN stories.scale IS 'Scale/zoom level of shared content (0.3 to 1.5)';
COMMENT ON COLUMN stories.cloudinary_public_id IS 'Cloudinary public ID for uploaded stories, NULL for shared stories';
