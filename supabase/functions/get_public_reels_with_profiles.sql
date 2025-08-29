CREATE OR REPLACE FUNCTION get_public_reels_with_profiles()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  media_url TEXT,
  caption TEXT,
  username TEXT,
  avatar_url TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.created_at,
    p.user_id,
    p.media_url,
    p.caption,
    pr.username,
    pr.avatar_url
  FROM
    public.posts p
  JOIN
    public.profiles pr ON p.user_id = pr.id
  WHERE
    p.type = 'video'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = p.user_id
      AND us.private_account = true
    )
  ORDER BY
    p.created_at DESC
  LIMIT 10;
END;
$$;
