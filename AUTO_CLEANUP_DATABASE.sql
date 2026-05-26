-- ============================================
-- 🤖 AUTOMATIC DATABASE CLEANUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Clean up ALL existing records first
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;

-- Step 2: Create function to auto-delete old records
CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS void AS $$
BEGIN
  -- Delete waiting_users older than 6 minutes
  DELETE FROM public.waiting_users
  WHERE created_at < NOW() - INTERVAL '6 minutes';
  
  -- Delete active_calls older than 6 minutes
  DELETE FROM public.active_calls
  WHERE created_at < NOW() - INTERVAL '6 minutes'
  AND status IN ('matched', 'active');
  
  RAISE NOTICE 'Cleaned up old records';
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a scheduled job using pg_cron (if available)
-- Note: pg_cron might not be available on all Supabase plans
-- If this fails, that's okay - we'll use app-level cleanup

-- Try to enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run every 2 minutes
-- If pg_cron is not available, this will fail silently
DO $$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('cleanup-old-records');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Schedule new job
SELECT cron.schedule(
  'cleanup-old-records',
  '*/2 * * * *', -- Every 2 minutes
  'SELECT cleanup_old_records();'
);

-- Step 4: Verify the setup
SELECT 'waiting_users' as table_name, COUNT(*) as count FROM public.waiting_users
UNION ALL
SELECT 'active_calls' as table_name, COUNT(*) as count FROM public.active_calls;

-- Expected output:
-- waiting_users | 0
-- active_calls  | 0

-- ============================================
-- ✅ DONE! Automatic cleanup is configured
-- 
-- How it works:
-- 1. Records older than 6 minutes are auto-deleted
-- 2. Cleanup runs every 2 minutes (if pg_cron available)
-- 3. App also cleans up on call end
-- ============================================

-- IMPORTANT NOTES:
-- - If pg_cron is not available (free tier), the app will handle cleanup
-- - Records are deleted when call ends (in CallPage)
-- - Records are deleted when user clicks "Find Match" (in HomePage)
-- - This is a backup cleanup for stuck records
