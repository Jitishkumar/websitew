-- Create RPC function to get user groups without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_user_groups(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  description TEXT,
  avatar_url TEXT,
  is_private BOOLEAN,
  auto_join BOOLEAN,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.avatar_url,
    g.is_private,
    g.auto_join,
    g.created_by,
    g.created_at,
    g.updated_at
  FROM public.groups g
  INNER JOIN public.group_members gm ON g.id = gm.group_id
  WHERE gm.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
