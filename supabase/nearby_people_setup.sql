-- Add location columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP DEFAULT NOW();

-- Create index for faster location queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles (current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_profiles_location_updated ON profiles (location_updated_at);

-- Optional: Create a function for distance calculation (if PostGIS is available)
CREATE OR REPLACE FUNCTION find_nearby_users(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_km DECIMAL,
  current_user_id UUID
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  current_latitude DECIMAL,
  current_longitude DECIMAL,
  location_updated_at TIMESTAMP,
  distance_meters DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.current_latitude,
    p.current_longitude,
    p.location_updated_at,
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(p.current_latitude)) * 
      cos(radians(p.current_longitude) - radians(user_lng)) + 
      sin(radians(user_lat)) * 
      sin(radians(p.current_latitude))
    )) as distance_meters
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.current_latitude IS NOT NULL
    AND p.current_longitude IS NOT NULL
    AND p.location_updated_at > NOW() - INTERVAL '24 hours'
    AND (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(p.current_latitude)) * 
      cos(radians(p.current_longitude) - radians(user_lng)) + 
      sin(radians(user_lat)) * 
      sin(radians(p.current_latitude))
    )) <= (radius_km * 1000)
  ORDER BY distance_meters
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Create a daily cleanup job to remove old location data (optional)
-- This keeps storage efficient by removing locations older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET current_latitude = NULL,
      current_longitude = NULL
  WHERE location_updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Set up RLS (Row Level Security) policies if needed
-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Users can view nearby profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own location" ON profiles;

-- Allow users to read nearby profiles
CREATE POLICY "Users can view nearby profiles" ON profiles
  FOR SELECT USING (
    current_latitude IS NOT NULL AND 
    current_longitude IS NOT NULL AND
    location_updated_at > NOW() - INTERVAL '24 hours'
  );

-- Allow users to update their own location
CREATE POLICY "Users can update own location" ON profiles
  FOR UPDATE USING (auth.uid() = id);
