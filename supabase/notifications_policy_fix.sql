-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- SIMPLER POLICY: Allow any authenticated user to create notifications
-- This is the most straightforward approach for your use case
CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Any authenticated user can create notifications
  true
);

-- Alternative option: If you want even more permissive (allow any authenticated user to create any notification)
-- Uncomment below and comment out the above policy if needed
/*
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow any authenticated user to create notifications
  (auth.role() = 'authenticated')
);
*/
