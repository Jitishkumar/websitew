

-- Create blocked_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users(blocked_id);

-- Enable Row Level Security
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Create policies for blocked_users table
-- Users can view their own blocked users list
CREATE POLICY "Users can view their own blocked users list"
  ON public.blocked_users
  FOR SELECT
  TO public
  USING (blocker_id = auth.uid());

-- Users can block other users
CREATE POLICY "Users can block other users"
  ON public.blocked_users
  FOR INSERT
  TO public
  WITH CHECK (blocker_id = auth.uid());

-- Users can unblock users they've blocked
CREATE POLICY "Users can unblock users they've blocked"
  ON public.blocked_users
  FOR DELETE
  TO public
  USING (blocker_id = auth.uid());

-- Create function to check if a user is blocked
DROP FUNCTION IF EXISTS public.is_user_blocked(blocker_id UUID, blocked_id UUID);
DROP FUNCTION IF EXISTS public.is_user_blocked(user_id1 UUID, user_id2 UUID);
DROP FUNCTION IF EXISTS public.is_blocked(UUID, UUID) CASCADE;

-- Create function to check if there is a block between two users
CREATE OR REPLACE FUNCTION is_blocked(user_id_1 UUID, user_id_2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM blocked_users
    WHERE (blocker_id = user_id_1 AND blocked_id = user_id_2) OR (blocker_id = user_id_2 AND blocked_id = user_id_1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
