-- ============================================
-- DONATIONS TABLE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_id TEXT NOT NULL UNIQUE,
  payment_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_verified ON donations(payment_verified);
CREATE INDEX IF NOT EXISTS idx_donations_amount ON donations(amount DESC);

-- Enable Row Level Security
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view verified donations (for leaderboard)
CREATE POLICY "Anyone can view verified donations"
  ON donations
  FOR SELECT
  USING (payment_verified = true);

-- Policy: Users can view their own donations (verified or not)
CREATE POLICY "Users can view own donations"
  ON donations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Authenticated users can insert donations
CREATE POLICY "Authenticated users can insert donations"
  ON donations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Only service role can update verification status
-- (This means only backend/admin can verify payments)
CREATE POLICY "Service role can update donations"
  ON donations
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================
-- VERIFICATION: Check if table was created
-- ============================================

-- Run this to verify:
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'donations'
ORDER BY ordinal_position;

-- ============================================
-- TEST DATA (Optional - for testing)
-- ============================================

-- Uncomment to add test donation:
/*
INSERT INTO donations (user_id, donor_name, amount, payment_id, payment_verified)
VALUES (
  auth.uid(),
  'Test Donor',
  100.00,
  'pay_test_' || gen_random_uuid(),
  true
);
*/

-- ============================================
-- QUERY: View all donations (for testing)
-- ============================================

SELECT 
  d.id,
  d.donor_name,
  d.amount,
  d.payment_id,
  d.payment_verified,
  d.created_at,
  p.username,
  p.email
FROM donations d
LEFT JOIN profiles p ON d.user_id = p.id
ORDER BY d.amount DESC, d.created_at DESC;

-- ============================================
-- QUERY: Top 10 Wealthiest Donors
-- ============================================

SELECT 
  donor_name,
  SUM(amount) as total_donated,
  COUNT(*) as donation_count,
  MAX(created_at) as last_donation
FROM donations
WHERE payment_verified = true
GROUP BY donor_name
ORDER BY total_donated DESC
LIMIT 10;
