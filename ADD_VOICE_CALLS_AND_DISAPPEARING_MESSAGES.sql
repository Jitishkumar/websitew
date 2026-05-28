-- ============================================
-- ADD VOICE CALLS AND DISAPPEARING MESSAGES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add call_type column to active_calls table
ALTER TABLE active_calls 
ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'video' CHECK (call_type IN ('video', 'voice'));

-- 2. Add call_type to waiting_users table
ALTER TABLE waiting_users
ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'video' CHECK (call_type IN ('video', 'voice'));



-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_active_calls_type ON active_calls(call_type);
CREATE INDEX IF NOT EXISTS idx_waiting_users_type ON waiting_users(call_type);

-- 5. Create function to auto-delete expired posts

-- 6. Create a scheduled job to run every hour (if pg_cron is available)
-- If pg_cron is not available, you'll need to call this function from your app
-- SELECT cron.schedule('delete-expired-posts', '0 * * * *', 'SELECT delete_expired_posts()');

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'active_calls' AND column_name = 'call_type';


-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- Create a voice call
-- INSERT INTO active_calls (call_id, call_type, ...) VALUES ('room123', 'voice', ...);

-- Create a disappearing post (1 hour)
-- INSERT INTO posts (caption, disappear_after) VALUES ('This will disappear', INTERVAL '1 hour');

-- Create a one-time view post
-- INSERT INTO posts (caption, one_time_view) VALUES ('View once only', true);

-- Manually delete expired posts
-- SELECT delete_expired_posts();
