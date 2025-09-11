-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view group members of groups they belong to" ON public.group_members;
DROP POLICY IF EXISTS "Group creators and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators and admins can update member roles" ON public.group_members;

-- Create simpler, non-recursive policies
CREATE POLICY "Users can view their own membership" ON public.group_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Group creators can view all members" ON public.group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Group creators can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Group creators can update member roles" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- Update the groups policy to be simpler
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "Users can view groups they created" ON public.groups
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can view groups they belong to" ON public.groups
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );
