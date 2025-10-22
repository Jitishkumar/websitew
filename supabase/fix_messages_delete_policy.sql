-- Enable Row Level Security on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;

-- Create a policy that allows users to delete messages where they are either sender or receiver
CREATE POLICY "Users can delete messages in their conversations"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages' AND cmd = 'DELETE';
