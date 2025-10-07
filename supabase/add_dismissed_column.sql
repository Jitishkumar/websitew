-- Add dismissed_by column to track users who dismissed notifications without sending read receipts
-- This is a JSONB array of user IDs who have dismissed the notification locally

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS dismissed_by jsonb DEFAULT '[]'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_dismissed_by 
ON public.messages USING gin (dismissed_by);

-- Add comment explaining the column
COMMENT ON COLUMN public.messages.dismissed_by IS 
'Array of user IDs who have dismissed this message notification locally without sending read receipts';

-- Example usage:
-- To mark as dismissed for a user: UPDATE messages SET dismissed_by = dismissed_by || '["user-id"]'::jsonb
-- To check if dismissed: WHERE dismissed_by ? 'user-id'
