-- Database Setup for Random Matching System
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Create waiting_users table
CREATE TABLE IF NOT EXISTS waiting_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  call_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_waiting_users_status ON waiting_users(status);
CREATE INDEX IF NOT EXISTS idx_waiting_users_created_at ON waiting_users(created_at);

-- 2. Create active_calls table
CREATE TABLE IF NOT EXISTS active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_name TEXT NOT NULL,
  user1_accepted BOOLEAN DEFAULT FALSE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_name TEXT NOT NULL,
  user2_accepted BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'matched',
  room_url TEXT NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_active_calls_status ON active_calls(status);
CREATE INDEX IF NOT EXISTS idx_active_calls_user1_id ON active_calls(user1_id);
CREATE INDEX IF NOT EXISTS idx_active_calls_user2_id ON active_calls(user2_id);
CREATE INDEX IF NOT EXISTS idx_active_calls_created_at ON active_calls(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE waiting_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_calls ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for waiting_users
-- Allow users to insert their own record
CREATE POLICY "Users can insert their own waiting record"
  ON waiting_users
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view all waiting users
CREATE POLICY "Users can view all waiting users"
  ON waiting_users
  FOR SELECT
  USING (true);

-- Allow users to delete their own record
CREATE POLICY "Users can delete their own waiting record"
  ON waiting_users
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service role to manage waiting_users
CREATE POLICY "Service role can manage waiting_users"
  ON waiting_users
  USING (true)
  WITH CHECK (true);

-- 5. Create RLS Policies for active_calls
-- Allow users to view calls they're part of
CREATE POLICY "Users can view their own calls"
  ON active_calls
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Allow users to insert calls (via service role)
CREATE POLICY "Service role can insert calls"
  ON active_calls
  FOR INSERT
  WITH CHECK (true);

-- Allow users to update calls they're part of
CREATE POLICY "Users can update their own calls"
  ON active_calls
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Allow users to delete calls they're part of
CREATE POLICY "Users can delete their own calls"
  ON active_calls
  FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Allow service role to manage active_calls
CREATE POLICY "Service role can manage active_calls"
  ON active_calls
  USING (true)
  WITH CHECK (true);

-- 6. Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('waiting_users', 'active_calls');

-- 7. Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('waiting_users', 'active_calls');

-- 8. Optional: Create a function to clean up old waiting users (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_waiting_users()
RETURNS void AS $$
BEGIN
  DELETE FROM waiting_users
  WHERE created_at < NOW() - INTERVAL '5 minutes'
  AND status = 'waiting';
END;
$$ LANGUAGE plpgsql;

-- 9. Optional: Create a function to clean up old calls (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_calls()
RETURNS void AS $$
BEGIN
  DELETE FROM active_calls
  WHERE created_at < NOW() - INTERVAL '1 hour'
  AND status IN ('ended', 'rejected');
END;
$$ LANGUAGE plpgsql;

-- 10. Optional: Create a cron job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-waiting-users', '*/5 * * * *', 'SELECT cleanup_old_waiting_users()');
-- SELECT cron.schedule('cleanup-old-calls', '0 * * * *', 'SELECT cleanup_old_calls()');

-- Notes:
-- 1. Make sure auth.users table exists (created automatically by Supabase)
-- 2. RLS policies allow users to see all waiting users (for matching)
-- 3. Service role can bypass RLS for backend operations
-- 4. Indexes improve query performance
-- 5. Cleanup functions remove old records to keep database clean
-- 6. Cron jobs require pg_cron extension to be enabled

-- Verification queries:
-- Check waiting users: SELECT * FROM waiting_users;
-- Check active calls: SELECT * FROM active_calls;
-- Check table sizes: SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public';
