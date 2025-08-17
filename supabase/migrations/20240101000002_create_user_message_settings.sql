-- Create user_message_settings table
CREATE TABLE IF NOT EXISTS public.user_message_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  show_online_status BOOLEAN DEFAULT TRUE,
  show_read_receipts BOOLEAN DEFAULT TRUE,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_message_settings_user_id ON public.user_message_settings(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_message_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_message_settings

-- Allow users to view each other's settings for features like online status and read receipts.
DROP POLICY IF EXISTS "Users can view their own message settings" ON public.user_message_settings;
DROP POLICY IF EXISTS "Users can view other users message settings" ON public.user_message_settings;
CREATE POLICY "Users can view other users message settings" ON public.user_message_settings
  FOR SELECT USING (true);

-- Users can only insert their own settings.
DROP POLICY IF EXISTS "Users can insert their own message settings" ON public.user_message_settings;
CREATE POLICY "Users can insert their own message settings" ON public.user_message_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own settings.
DROP POLICY IF EXISTS "Users can update their own message settings" ON public.user_message_settings;
CREATE POLICY "Users can update their own message settings" ON public.user_message_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_message_settings
  SET last_active = NOW()
  WHERE user_id = NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active on message send
CREATE TRIGGER update_last_active_on_message_send
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_active();

-- Function to get user's online status
CREATE OR REPLACE FUNCTION public.get_user_online_status(p_user_id UUID)
RETURNS TABLE(is_online BOOLEAN, last_active_time TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ums.last_active > NOW() - INTERVAL '5 minutes' AND ums.show_online_status) as is_online,
    ums.last_active as last_active_time
  FROM public.user_message_settings ums
  WHERE ums.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to manually update a user's last_active timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_active(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_message_settings
  SET last_active = NOW()
  WHERE user_id = update_user_last_active.user_id;
END;
$$ LANGUAGE plpgsql;









