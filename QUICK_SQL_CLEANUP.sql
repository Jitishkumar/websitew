-- ============================================
-- QUICK SQL CLEANUP - Copy & Paste This
-- ============================================
-- Run this in Supabase SQL Editor to clean stuck records

-- Step 1: Delete all stuck waiting users
DELETE FROM public.waiting_users WHERE status = 'waiting';

-- Step 2: Delete all stuck active calls
DELETE FROM public.active_calls WHERE status IN ('active', 'matched');

-- Step 3: Verify cleanup (should show 0 for both)
SELECT COUNT(*) as waiting_users_count FROM public.waiting_users;
SELECT COUNT(*) as active_calls_count FROM public.active_calls;

-- ============================================
-- DONE! Your database is now clean.
-- ============================================