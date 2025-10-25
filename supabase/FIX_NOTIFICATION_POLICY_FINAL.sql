-- ========================================
-- FINAL FIX FOR NOTIFICATION RLS POLICY
-- ========================================
-- Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Drop all existing notification policies
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Step 2: Recreate INSERT policy (most permissive for your use case)
CREATE POLICY "Users can insert notifications"
ON public.notifications
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 3: Recreate UPDATE policy (users can only update their own)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Step 4: Recreate SELECT policy (users can only see their own)
CREATE POLICY "Users can view their own notifications"
ON public.notifications
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

-- Step 5: Verify policies were created
SELECT 
  policyname,
  cmd,
  with_check,
  qual
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd;

-- Expected output:
-- INSERT policy: with_check = 'true'
-- UPDATE policy: qual = '(recipient_id = auth.uid())', with_check = '(recipient_id = auth.uid())'
-- SELECT policy: qual = '(recipient_id = auth.uid())'
