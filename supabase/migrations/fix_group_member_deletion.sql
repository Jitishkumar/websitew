-- Fix infinite recursion in group_members policies
-- The issue is that policies are referencing the same table they're applied to

-- First, drop ALL existing policies on group_members to start fresh
DROP POLICY IF EXISTS "Users can view their own membership" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can view all members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can delete members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

-- Create non-recursive policies using only the groups table for admin checks

-- 1. SELECT policies
CREATE POLICY "Users can view their own membership" ON public.group_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Group creators can view all members" ON public.group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 2. INSERT policies  
CREATE POLICY "Group creators can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 3. UPDATE policies (only for group creators, not admins to avoid recursion)
CREATE POLICY "Group creators can update member roles" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 4. DELETE policies
CREATE POLICY "Group creators can delete members" ON public.group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can leave groups themselves" ON public.group_members
  FOR DELETE USING (user_id = auth.uid());
