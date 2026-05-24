-- Add room_url column to waiting_users table
ALTER TABLE waiting_users ADD COLUMN room_url TEXT;

-- Add room_url column to active_calls table  
ALTER TABLE active_calls ADD COLUMN room_url TEXT;

-- Update any existing records (optional, for cleanup)
-- UPDATE waiting_users SET room_url = 'https://perfectfl.daily.co/' || call_id WHERE room_url IS NULL;
-- UPDATE active_calls SET room_url = 'https://perfectfl.daily.co/' || call_id WHERE room_url IS NULL;