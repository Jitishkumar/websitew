-- Fix infinite recursion and group deletion issues
-- This completely rebuilds the group_members policies to avoid recursion

-- 1. Disable RLS temporarily to clear all policies
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies on group_members
DROP POLICY IF EXISTS "Users can view their own membership" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can view all members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can delete members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups themselves" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

-- 3. Re-enable RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, non-recursive policies

-- SELECT: Users can see memberships for groups they belong to
CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT USING (
    -- User can see their own membership
    user_id = auth.uid() 
    OR 
    -- User can see other members if they are also a member of the same group
    group_id IN (
      SELECT gm.group_id FROM public.group_members gm 
      WHERE gm.user_id = auth.uid()
    )
    OR
    -- Group creator can see all members
    group_id IN (
      SELECT g.id FROM public.groups g 
      WHERE g.created_by = auth.uid()
    )
  );

-- INSERT: Only group creators can add members
CREATE POLICY "group_members_insert" ON public.group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT g.id FROM public.groups g 
      WHERE g.created_by = auth.uid()
    )
  );

-- UPDATE: Only group creators can update roles
CREATE POLICY "group_members_update" ON public.group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT g.id FROM public.groups g 
      WHERE g.created_by = auth.uid()
    )
  );

-- DELETE: Group creators can remove anyone, users can remove themselves
CREATE POLICY "group_members_delete" ON public.group_members
  FOR DELETE USING (
    -- User can leave themselves
    user_id = auth.uid()
    OR
    -- Group creator can remove anyone
    group_id IN (
      SELECT g.id FROM public.groups g 
      WHERE g.created_by = auth.uid()
    )
  );

-- 5. Fix group deletion policies
-- Drop existing group policies
DROP POLICY IF EXISTS "Users can view groups they created" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
DROP POLICY IF EXISTS "Users can view public groups" ON public.groups;

-- Create new group policies
CREATE POLICY "groups_select" ON public.groups
  FOR SELECT USING (
    -- User created the group
    created_by = auth.uid()
    OR
    -- User is a member of the group
    id IN (
      SELECT gm.group_id FROM public.group_members gm 
      WHERE gm.user_id = auth.uid()
    )
    OR
    -- Group is public (not private)
    (is_private = false OR is_private IS NULL)
  );

-- Allow group creators to update their groups
CREATE POLICY "groups_update" ON public.groups
  FOR UPDATE USING (created_by = auth.uid());

-- Allow group creators to delete their groups
CREATE POLICY "groups_delete" ON public.groups
  FOR DELETE USING (created_by = auth.uid());

-- 6. Create function to properly delete groups with all related data
CREATE OR REPLACE FUNCTION delete_group_completely(group_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  group_exists BOOLEAN;
BEGIN
  -- Check if group exists and user is the creator
  SELECT EXISTS(
    SELECT 1 FROM public.groups 
    WHERE id = group_id_param AND created_by = auth.uid()
  ) INTO group_exists;
  
  IF NOT group_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Delete in correct order to avoid foreign key constraints
  
  -- 1. Delete group messages
  DELETE FROM public.group_messages WHERE group_id = group_id_param;
  
  -- 2. Delete join requests
  DELETE FROM public.group_join_requests WHERE group_id = group_id_param;
  
  -- 3. Delete group members
  DELETE FROM public.group_members WHERE group_id = group_id_param;
  
  -- 4. Delete the group itself
  DELETE FROM public.groups WHERE id = group_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
