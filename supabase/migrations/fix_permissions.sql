-- 1. Grant necessary permissions on the public schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant select on all tables and views to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- 4. Drop existing view if it exists
DROP VIEW IF EXISTS public.group_join_requests_with_profile;

-- 5. Recreate the view with explicit column selection and type casting
CREATE OR REPLACE VIEW public.group_join_requests_with_profile AS
SELECT 
  gjr.id,
  gjr.group_id,
  gjr.user_id,
  gjr.message,
  gjr.status,
  gjr.created_at AT TIME ZONE 'UTC' AS created_at,
  gjr.updated_at AT TIME ZONE 'UTC' AS updated_at,
  p.username,
  p.avatar_url,
  p.full_name
FROM 
  public.group_join_requests gjr
JOIN 
  public.profiles p ON gjr.user_id = p.id;

-- 5. Grant select on the view to authenticated users
GRANT SELECT ON public.group_join_requests_with_profile TO authenticated;

-- 6. Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_group_join_requests(UUID);

-- 7. Recreate the function with proper column mapping
CREATE OR REPLACE FUNCTION public.get_group_join_requests(group_id_param UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  user_id UUID,
  message TEXT,
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
  SELECT 
    id,
    group_id,
    user_id,
    message,
    status,
    created_at,
    updated_at,
    username,
    avatar_url,
    full_name
  FROM public.group_join_requests_with_profile
  WHERE group_id = group_id_param
  AND (user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.groups g 
        WHERE g.id = group_id_param AND g.created_by = auth.uid()
      )
  );
$$;

-- 8. Set function owner to postgres and grant necessary permissions
ALTER FUNCTION public.get_group_join_requests(UUID) OWNER TO postgres;

-- 9. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_group_join_requests(UUID) TO authenticated;

-- 10. Ensure the view owner has proper permissions
ALTER VIEW public.group_join_requests_with_profile OWNER TO postgres;

-- 11. Grant select on the view to authenticated users (redundant but ensures it's set)
GRANT SELECT ON public.group_join_requests_with_profile TO authenticated;
