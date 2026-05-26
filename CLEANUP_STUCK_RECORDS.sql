-- ============================================
-- CLEANUP STUCK RECORDS IN DATABASE
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. DELETE ALL STUCK RECORDS FROM waiting_users
-- This will remove all users who are stuck in "waiting" status
DELETE FROM public.waiting_users 
WHERE status = 'waiting';

-- 2. DELETE ALL STUCK RECORDS FROM active_calls
-- This will remove all calls that are stuck in "active" or "matched" status
DELETE FROM public.active_calls 
WHERE status IN ('active', 'matched');

-- 3. VERIFY CLEANUP - Check if tables are empty
SELECT COUNT(*) as waiting_users_count FROM public.waiting_users;
SELECT COUNT(*) as active_calls_count FROM public.active_calls;

-- Expected output: Both should show 0 rows

-- ============================================
-- OPTIONAL: If you want to see what will be deleted first
-- ============================================

-- View all waiting users before deletion
-- SELECT * FROM public.waiting_users WHERE status = 'waiting';

-- View all active calls before deletion
-- SELECT * FROM public.active_calls WHERE status IN ('active', 'matched');

-- ============================================
-- OPTIONAL: Delete everything (nuclear option)
-- ============================================

-- DELETE ALL records from waiting_users
-- DELETE FROM public.waiting_users;

-- DELETE ALL records from active_calls
-- DELETE FROM public.active_calls;

-- ============================================
-- VERIFY TABLES ARE CLEAN
-- ============================================

-- Check waiting_users table
SELECT id, user_id, username, status, created_at FROM public.waiting_users LIMIT 10;

-- Check active_calls table
SELECT id, call_id, user1_id, user2_id, status, created_at FROM public.active_calls LIMIT 10;

-- ============================================
-- DONE!
-- ============================================
-- Your database is now clean and ready to use