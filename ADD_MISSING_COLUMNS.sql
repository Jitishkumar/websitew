-- ============================================
-- ADD MISSING COLUMNS TO active_calls TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add user1_accepted column if it doesn't exist
ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS user1_accepted BOOLEAN DEFAULT FALSE;

-- Add user2_accepted column if it doesn't exist
ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS user2_accepted BOOLEAN DEFAULT FALSE;

-- Add started_at column if it doesn't exist
ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE NULL;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'active_calls' 
AND column_name IN ('user1_accepted', 'user2_accepted', 'started_at');

-- Expected output:
-- user1_accepted | boolean | false
-- user2_accepted | boolean | false
-- started_at | timestamp with time zone | NULL

-- ============================================
-- DONE! Columns added successfully
-- ============================================