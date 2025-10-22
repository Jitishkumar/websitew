-- Fix Row Level Security (RLS) policies for messages table
-- This allows users to delete messages they sent or received

-- First, check if RLS is enabled
-- If not enabled, enable it
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages they sent" ON messages;
DROP POLICY IF EXISTS "Users can delete messages they received" ON messages;
DROP POLICY IF EXISTS "Allow delete for message participants" ON messages;

-- Create a comprehensive delete policy
-- This allows users to delete messages where they are either sender OR receiver
CREATE POLICY "Users can delete messages they are part of"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Also ensure users can SELECT messages they are part of (for the delete query to work)
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
ON messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Ensure users can INSERT messages (for sending new messages)
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- Ensure users can UPDATE messages (for marking as read)
DROP POLICY IF EXISTS "Users can update their messages" ON messages;
CREATE POLICY "Users can update their messages"
ON messages
FOR UPDATE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages';
