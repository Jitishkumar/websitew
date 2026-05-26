-- ============================================
-- 🧹 CLEAN DATABASE - Run this NOW to fix user count
-- ============================================

-- Step 1: Delete ALL records from waiting_users
DELETE FROM public.waiting_users;

-- Step 2: Delete ALL records from active_calls
DELETE FROM public.active_calls;

-- Step 3: Verify tables are empty
SELECT 'waiting_users' as table_name, COUNT(*) as count FROM public.waiting_users
UNION ALL
SELECT 'active_calls' as table_name, COUNT(*) as count FROM public.active_calls;

-- Expected output:
-- waiting_users | 0
-- active_calls  | 0

-- ============================================
-- ✅ DONE! Database is clean
-- Now the user count should be accurate
-- ============================================
