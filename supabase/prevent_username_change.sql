-- Function to prevent username changes for verified accounts
CREATE OR REPLACE FUNCTION prevent_username_change_if_verified()
RETURNS TRIGGER AS $$
DECLARE
  is_verified BOOLEAN;
BEGIN
  -- Check if the account is verified and username is being changed
  -- Look up in verified_accounts table instead of using a column in profiles
  SELECT verified INTO is_verified
  FROM verified_accounts
  WHERE id = OLD.id;
  
  IF is_verified = TRUE AND NEW.username <> OLD.username THEN
    RAISE EXCEPTION 'Cannot change username for verified accounts';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;