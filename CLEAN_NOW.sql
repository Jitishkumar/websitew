-- ============================================
-- 🧹 CLEAN DATABASE NOW - Quick Fix
-- Copy and paste this into Supabase SQL Editor
-- ============================================

-- Delete ALL records
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;

-- Verify it's clean
SELECT 'waiting_users' as table, COUNT(*) as count FROM public.waiting_users
UNION ALL
SELECT 'active_calls' as table, COUNT(*) as count FROM public.active_calls;

-- Expected: Both should show 0

-- ✅ DONE! Database is clean
-- Now the user count should be accurate
