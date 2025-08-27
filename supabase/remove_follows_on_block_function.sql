
CREATE OR REPLACE FUNCTION remove_follows_on_block()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete follow relationships where the blocker was following the blocked user
  DELETE FROM public.follows
  WHERE follower_id = NEW.blocker_id AND following_id = NEW.blocked_id;

  -- Delete follow relationships where the blocked user was following the blocker
  DELETE FROM public.follows
  WHERE follower_id = NEW.blocked_id AND following_id = NEW.blocker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
