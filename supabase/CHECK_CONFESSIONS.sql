-- Check if your confessions were actually saved
-- Replace 'YOUR_USER_ID' with: b10c9a97-1fe9-4b34-9f7f-f5762e460a63

SELECT 
  id,
  person_id,
  person_name,
  content,
  is_anonymous,
  created_at,
  creator_id
FROM person_confessions
WHERE creator_id = 'b10c9a97-1fe9-4b34-9f7f-f5762e460a63'
ORDER BY created_at DESC
LIMIT 10;

-- Check all confessions (to see if any exist at all)
SELECT COUNT(*) as total_confessions FROM person_confessions;

-- Check the notification policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'notifications';
