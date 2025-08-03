-- This script fixes the RLS policy error for the verified_accounts table
-- Error: "new row violates row-level security policy for table "verified_accounts""

-- First, check if RLS is enabled on the verified_accounts table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'verified_accounts';

-- Check existing RLS policies on the verified_accounts table
SELECT * 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'verified_accounts';

-- Enable Row Level Security if not already enabled
ALTER TABLE public.verified_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to insert their own verification data
DROP POLICY IF EXISTS "Users can insert their own verification data" ON public.verified_accounts;
CREATE POLICY "Users can insert their own verification data"
  ON public.verified_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy to allow users to update their own verification data
DROP POLICY IF EXISTS "Users can update their own verification data" ON public.verified_accounts;
CREATE POLICY "Users can update their own verification data"
  ON public.verified_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create policy to allow users to view their own verification status
DROP POLICY IF EXISTS "Users can view their own verification status" ON public.verified_accounts;
CREATE POLICY "Users can view their own verification status"
  ON public.verified_accounts
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow users to view other users' verification status
DROP POLICY IF EXISTS "Users can view other users' verification status" ON public.verified_accounts;
CREATE POLICY "Users can view other users' verification status"
  ON public.verified_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- For testing purposes, you can run this query to check if a specific user has a record in the verified_accounts table
-- Replace 'user_id_here' with the actual user ID
-- SELECT * FROM public.verified_accounts WHERE id = 'user_id_here';