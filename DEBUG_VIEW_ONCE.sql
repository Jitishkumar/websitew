-- Debug View Once Messages
-- Run these queries in Supabase SQL Editor to debug the issue

-- 1. Check all view-once messages in database
SELECT 
  id,
  sender_id,
  receiver_id,
  content,
  view_once,
  viewed_by,
  created_at,
  media_url IS NOT NULL as has_media
FROM messages 
WHERE view_once = true 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check RLS policies on messages table
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- 3. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerowsecurity 
FROM pg_tables 
WHERE tablename = 'messages';

-- 4. Test current user permissions
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- 5. Check messages that current user can see
SELECT 
  id,
  sender_id,
  receiver_id,
  view_once,
  auth.uid() = sender_id as is_sender,
  auth.uid() = receiver_id as is_receiver
FROM messages 
WHERE view_once = true
  AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Test deletion permissions (don't actually delete, just check)
EXPLAIN (ANALYZE, BUFFERS) 
DELETE FROM messages 
WHERE view_once = true 
  AND id = 'test-id-that-does-not-exist';

-- 7. Check if delete function exists
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'delete_view_once_message';

-- 8. Manual cleanup of old view-once messages (if needed)
-- UNCOMMENT ONLY IF YOU WANT TO DELETE ALL VIEW-ONCE MESSAGES
-- DELETE FROM messages WHERE view_once = true;

-- 9. Check message counts
SELECT 
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE view_once = true) as view_once_messages,
  COUNT(*) FILTER (WHERE view_once = true AND array_length(viewed_by, 1) > 0) as viewed_messages
FROM messages;

-- 10. Find messages that should have been deleted
SELECT 
  id,
  sender_id,
  receiver_id,
  view_once,
  viewed_by,
  array_length(viewed_by, 1) as viewer_count,
  created_at
FROM messages 
WHERE view_once = true 
  AND array_length(viewed_by, 1) > 0
ORDER BY created_at DESC;