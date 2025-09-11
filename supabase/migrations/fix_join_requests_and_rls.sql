-- 1. Create a view that joins group_join_requests with profiles
CREATE OR REPLACE VIEW public.group_join_requests_with_profile AS
SELECT 
  gjr.*,
  p.username,
  p.avatar_url,
  p.full_name
FROM 
  public.group_join_requests gjr
JOIN 
  public.profiles p ON gjr.user_id = p.id;

-- 2. Enable RLS on the view
ALTER VIEW public.group_join_requests_with_profile OWNER TO authenticated;

-- 3. Create RLS policies for the view
CREATE POLICY "Allow read access to requesters" 
  ON public.group_join_requests_with_profile
  FOR SELECT 
  USING (user_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM public.groups g 
           WHERE g.id = group_id AND g.created_by = auth.uid()
         )
  );

-- 4. Enable RLS on groups and group_members
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 5. Basic RLS policies for groups
CREATE POLICY "Allow public read access to groups"
  ON public.groups
  FOR SELECT
  USING (true);

CREATE POLICY "Allow group creators full access"
  ON public.groups
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 6. Basic RLS policies for group_members
CREATE POLICY "Allow members to view their groups"
  ON public.group_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow group creators to manage members"
  ON public.group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 7. Drop and recreate the get_join_requests function to use the new view
CREATE OR REPLACE FUNCTION public.get_group_join_requests(group_id_param UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  user_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  username TEXT,
  avatar_url TEXT,
  full_name TEXT
) 
LANGUAGE SQL 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.group_join_requests_with_profile
  WHERE group_id = group_id_param
  AND (user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.groups g 
        WHERE g.id = group_id_param AND g.created_by = auth.uid()
      )
  );
$$;

-- 8. Set function owner to postgres to ensure proper permissions
ALTER FUNCTION public.get_group_join_requests(UUID) OWNER TO postgres;

-- 9. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_group_join_requests(UUID) TO authenticated;
