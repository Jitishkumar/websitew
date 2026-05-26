-- ============================================
-- 🚀 QUICK SETUP - Copy and paste this entire file into Supabase SQL Editor
-- ============================================

-- Step 1: Clean up any stuck records
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;

-- Step 2: Add missing columns to active_calls
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS user1_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS user2_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE NULL;

-- Step 3: Verify columns were added (check output below)
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'active_calls' 
AND column_name IN ('user1_accepted', 'user2_accepted', 'started_at');

-- ✅ Expected output:
-- user1_accepted | boolean | false
-- user2_accepted | boolean | false
-- started_at | timestamp with time zone | NULL

-- ============================================
-- DONE! Your database is ready for matching with accept/reject flow
-- ============================================
