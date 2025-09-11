-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Anyone can increment views" ON "public"."posts";

-- Create a function to handle view increments securely
CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts 
  SET views = COALESCE(views, 0) + 1 
  WHERE id = post_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_post_views(UUID) TO authenticated;
