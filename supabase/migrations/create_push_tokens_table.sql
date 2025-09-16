-- Create user_push_tokens table
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own push tokens" ON user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" ON user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own push tokens" ON user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
