-- Add privacy and auto-join features to groups
-- This migration adds private groups and join request functionality

-- 1. Add new columns to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_join BOOLEAN DEFAULT false;

-- 2. Create group_join_requests table for pending join requests
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_join_requests_group_id ON public.group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_user_id ON public.group_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_status ON public.group_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_groups_is_private ON public.groups(is_private);

-- 4. Enable RLS on group_join_requests
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for group_join_requests

-- Users can view their own join requests
CREATE POLICY "Users can view their own join requests" ON public.group_join_requests
  FOR SELECT USING (user_id = auth.uid());

-- Group creators can view all join requests for their groups
CREATE POLICY "Group creators can view join requests" ON public.group_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- Users can create join requests for groups they're not already in
CREATE POLICY "Users can create join requests" ON public.group_join_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    NOT EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = group_join_requests.group_id AND gm.user_id = auth.uid()
    )
  );

-- Group creators can update join request status
CREATE POLICY "Group creators can update join requests" ON public.group_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- Users can delete their own pending join requests
CREATE POLICY "Users can delete their own join requests" ON public.group_join_requests
  FOR DELETE USING (user_id = auth.uid() AND status = 'pending');

-- Group creators can delete join requests for their groups
CREATE POLICY "Group creators can delete join requests" ON public.group_join_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 6. Update groups policies to handle private groups

-- Drop existing group view policies
DROP POLICY IF EXISTS "Users can view groups they created" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;

-- Users can view groups they created (all groups)
CREATE POLICY "Users can view groups they created" ON public.groups
  FOR SELECT USING (created_by = auth.uid());

-- Users can view public groups they belong to
CREATE POLICY "Users can view groups they belong to" ON public.groups
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Users can view public groups (for search functionality)
CREATE POLICY "Users can view public groups" ON public.groups
  FOR SELECT USING (is_private = false);

-- 7. Create function to auto-approve join requests for auto_join groups
CREATE OR REPLACE FUNCTION handle_auto_join_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the group has auto_join enabled
  IF EXISTS (
    SELECT 1 FROM public.groups 
    WHERE id = NEW.group_id AND auto_join = true
  ) THEN
    -- Auto-approve the request
    NEW.status := 'approved';
    
    -- Add user to group_members
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.group_id, NEW.user_id, 'member');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger for auto-join functionality
DROP TRIGGER IF EXISTS trigger_auto_join_request ON public.group_join_requests;
CREATE TRIGGER trigger_auto_join_request
  BEFORE INSERT ON public.group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_auto_join_request();

-- 9. Add updated_at trigger for group_join_requests
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_group_join_requests_updated_at ON public.group_join_requests;
CREATE TRIGGER update_group_join_requests_updated_at
  BEFORE UPDATE ON public.group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
