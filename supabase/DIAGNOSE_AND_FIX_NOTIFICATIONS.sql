-- ============================================
-- STEP 1: DIAGNOSE THE EXACT PROBLEM
-- ============================================
-- Run this first and SHARE THE RESULTS with me

-- Check ALL policies on notifications table
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'notifications';

-- ============================================
-- STEP 2: NUCLEAR OPTION - COMPLETE RESET
-- ============================================
-- Only run this AFTER sharing results from Step 1

-- Disable RLS temporarily
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (regardless of name)
DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create fresh, clean policies
CREATE POLICY "allow_authenticated_insert"
ON public.notifications
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "allow_select_own"
ON public.notifications
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "allow_update_own"
ON public.notifications
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- ============================================
-- STEP 3: VERIFY THE FIX
-- ============================================

-- Check new policies
SELECT 
  policyname,
  cmd,
  with_check,
  qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd;

-- Expected results:
-- INSERT: with_check = 'true'
-- SELECT: qual = '(recipient_id = auth.uid())'  
-- UPDATE: qual = '(recipient_id = auth.uid())', with_check = '(recipient_id = auth.uid())'

-- Test insert permission (replace with your actual user ID)
-- This should work without errors
INSERT INTO notifications (
  recipient_id,
  sender_id,
  type,
  content,
  reference_id,
  post_id
) VALUES (
  'b10c9a97-1fe9-4b34-9f7f-f5762e460a63',
  'b10c9a97-1fe9-4b34-9f7f-f5762e460a63',
  'person_confession',
  'Test notification',
  'b10c9a97-1fe9-4b34-9f7f-f5762e460a63',
  'confession_123'
);

-- If the above worked, delete the test
DELETE FROM notifications WHERE content = 'Test notification';

-- ============================================
-- STEP 4: ALTERNATIVE - SERVICE ROLE BYPASS
-- ============================================
-- If policies still don't work, this is a temporary workaround
-- (Less secure but will work while we debug)

/*
-- Drop all policies
DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- Disable RLS completely (TEMPORARY - use only for testing)
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
*/
