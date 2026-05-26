-- ============================================
-- COMPLETE DATABASE SETUP FOR RANDOM MATCHING
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Clean up any stuck records first
-- ============================================
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;

-- Step 2: Add missing columns to active_calls table
-- ============================================
ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS user1_accepted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS user2_accepted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE NULL;

-- Step 3: Verify the tables exist with correct structure
-- ============================================

-- Verify waiting_users table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'waiting_users' 
ORDER BY ordinal_position;

-- Expected columns:
-- id, user_id, username, gender, call_id, created_at, status, room_url

-- Verify active_calls table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'active_calls' 
ORDER BY ordinal_position;

-- Expected columns:
-- id, call_id, user1_id, user1_name, user2_id, user2_name, 
-- created_at, status, ended_at, room_url, 
-- user1_accepted, user2_accepted, started_at

-- Step 4: Create indexes for better performance (if not exist)
-- ============================================

-- Indexes for waiting_users
CREATE INDEX IF NOT EXISTS waiting_users_user_id_idx 
ON public.waiting_users USING btree (user_id);

CREATE INDEX IF NOT EXISTS waiting_users_status_idx 
ON public.waiting_users USING btree (status);

CREATE INDEX IF NOT EXISTS waiting_users_created_at_idx 
ON public.waiting_users USING btree (created_at);

-- Indexes for active_calls
CREATE INDEX IF NOT EXISTS active_calls_call_id_idx 
ON public.active_calls USING btree (call_id);

CREATE INDEX IF NOT EXISTS active_calls_user1_id_idx 
ON public.active_calls USING btree (user1_id);

CREATE INDEX IF NOT EXISTS active_calls_user2_id_idx 
ON public.active_calls USING btree (user2_id);

CREATE INDEX IF NOT EXISTS active_calls_status_idx 
ON public.active_calls USING btree (status);

-- Step 5: Verify profiles table has required columns
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('id', 'username', 'avatar_url')
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid), username (text), avatar_url (text)

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if any records exist (should be empty after cleanup)
SELECT 'waiting_users' as table_name, COUNT(*) as count FROM public.waiting_users
UNION ALL
SELECT 'active_calls' as table_name, COUNT(*) as count FROM public.active_calls;

-- Check column structure of active_calls
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'active_calls'
AND column_name IN ('user1_accepted', 'user2_accepted', 'started_at')
ORDER BY ordinal_position;

-- ============================================
-- EXPECTED OUTPUT:
-- ============================================
-- user1_accepted | boolean | YES | false
-- user2_accepted | boolean | YES | false
-- started_at | timestamp with time zone | YES | NULL

-- ============================================
-- DONE! Database is ready for random matching
-- ============================================

-- IMPORTANT NOTES:
-- 1. Both users must accept the match before call starts
-- 2. Profile photos are fetched from profiles.avatar_url
-- 3. Records are automatically cleaned up when users click "Find Match"
-- 4. Records are deleted when either user ends the call
