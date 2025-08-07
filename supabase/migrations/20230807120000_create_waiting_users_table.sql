-- Create waiting_users table to manage users waiting for video call matches
CREATE TABLE IF NOT EXISTS public.waiting_users (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    gender TEXT NOT NULL,
    call_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waiting_users_gender ON public.waiting_users (gender);
CREATE INDEX IF NOT EXISTS idx_waiting_users_created_at ON public.waiting_users (created_at);

-- Set up RLS (Row Level Security) policies
ALTER TABLE public.waiting_users ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own waiting status
CREATE POLICY "Users can view their own waiting status"
ON public.waiting_users
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert themselves into the waiting list
CREATE POLICY "Users can add themselves to waiting list"
ON public.waiting_users
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to remove themselves from the waiting list
CREATE POLICY "Users can remove themselves from waiting list"
ON public.waiting_users
FOR DELETE
USING (auth.uid() = user_id);

-- Function to clean up old waiting entries (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_waiting_entries()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.waiting_users 
    WHERE created_at < (NOW() - INTERVAL '5 minutes');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that runs the cleanup function periodically
CREATE OR REPLACE TRIGGER trigger_cleanup_old_entries
AFTER INSERT ON public.waiting_users
EXECUTE FUNCTION public.cleanup_old_waiting_entries();

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON TABLE public.waiting_users TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.waiting_users_id_seq TO authenticated, anon;
