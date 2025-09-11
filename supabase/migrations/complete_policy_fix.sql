-- Complete fix for infinite recursion - more aggressive approach
-- This migration completely removes the problematic policies and creates simpler ones

-- 1. Completely disable RLS and drop everything
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies (including any that might have been missed)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'group_members' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.group_members';
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 4. Create ONE simple policy for each operation (no complex joins)

-- SELECT: Allow if user is group creator OR user is member of the group
CREATE POLICY "simple_group_members_select" ON public.group_members
  FOR SELECT USING (
    -- User can see their own membership
    user_id = auth.uid() 
    OR 
    -- User is creator of the group (check groups table directly)
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- INSERT: Only group creators
CREATE POLICY "simple_group_members_insert" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- UPDATE: Only group creators
CREATE POLICY "simple_group_members_update" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- DELETE: Group creators or users removing themselves
CREATE POLICY "simple_group_members_delete" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 5. Also fix groups table policies
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'groups' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.groups';
    END LOOP;
END $$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Simple groups policies
CREATE POLICY "simple_groups_select" ON public.groups
  FOR SELECT USING (
    created_by = auth.uid()
    OR
    (is_private = false OR is_private IS NULL)
    OR
    id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "simple_groups_update" ON public.groups
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "simple_groups_delete" ON public.groups
  FOR DELETE USING (created_by = auth.uid());
