-- Add dismissed_by column to messages table
-- This column stores an array of user IDs who have dismissed/deleted the conversation from their side

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS dismissed_by TEXT[] DEFAULT '{}';

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_dismissed_by ON messages USING GIN (dismissed_by);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN messages.dismissed_by IS 'Array of user IDs who have dismissed this message from their conversation list';
