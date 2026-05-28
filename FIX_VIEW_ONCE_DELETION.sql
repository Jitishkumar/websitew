-- Fix View Once Message Deletion Issues
-- Run this in Supabase SQL Editor

-- 1. Check current RLS policies on messages table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'messages';

-- 2. Check if RLS is enabled (compatible version)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'messages';

-- 3. Create or update RLS policy to allow message deletion by sender or receiver
DROP POLICY IF EXISTS "Users can delete their own messages or received messages" ON messages;

CREATE POLICY "Users can delete their own messages or received messages" ON messages
FOR DELETE USING (
  auth.uid() = sender_id OR 
  auth.uid() = receiver_id
);

-- 4. Ensure users can delete view-once messages specifically
DROP POLICY IF EXISTS "Allow view-once message deletion" ON messages;

CREATE POLICY "Allow view-once message deletion" ON messages
FOR DELETE USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id) AND
  (view_once = true OR view_once IS NULL)
);

-- 5. Check existing policies after creation
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages' AND cmd = 'DELETE';

-- 6. Create function to safely delete view-once messages
CREATE OR REPLACE FUNCTION delete_view_once_message(message_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_record RECORD;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get message details
  SELECT * INTO message_record 
  FROM messages 
  WHERE id = message_uuid;
  
  -- Check if message exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check if it's a view-once message
  IF message_record.view_once IS NOT TRUE THEN
    RAISE EXCEPTION 'Not a view-once message';
  END IF;
  
  -- Check if user has permission (sender or receiver)
  IF current_user_id != message_record.sender_id AND current_user_id != message_record.receiver_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete the message
  DELETE FROM messages WHERE id = message_uuid;
  
  -- Return success
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE LOG 'Error deleting view-once message: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 7. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_view_once_message(UUID) TO authenticated;

COMMENT ON FUNCTION delete_view_once_message(UUID) IS 'Safely delete view-once messages with proper permission checks';