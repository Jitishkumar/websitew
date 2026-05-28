-- Add view_once column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS view_once BOOLEAN DEFAULT FALSE;

-- Add viewed_by column to track who has viewed the message
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS viewed_by TEXT[] DEFAULT '{}';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(view_once) WHERE view_once = TRUE;

-- Comment
COMMENT ON COLUMN messages.view_once IS 'Whether this message is a view-once message (disappears after viewing)';
COMMENT ON COLUMN messages.viewed_by IS 'Array of user IDs who have viewed this view-once message';
