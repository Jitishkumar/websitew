-- Enable Row Level Security for verified_accounts table
ALTER TABLE public.verified_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own verification status
CREATE POLICY "Users can view their own verification status"
  ON public.verified_accounts
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow users to view other users' verification status
CREATE POLICY "Users can view other users' verification status"
  ON public.verified_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow users to insert their own verification data
CREATE POLICY "Users can insert their own verification data"
  ON public.verified_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy to allow users to update their own verification data
CREATE POLICY "Users can update their own verification data"
  ON public.verified_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);


-- Create function to automatically expire verification after one month
CREATE OR REPLACE FUNCTION expire_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- If the record is being updated and verified is being set to true
  IF TG_OP = 'UPDATE' AND NEW.verified = TRUE AND (OLD.verified IS NULL OR OLD.verified = FALSE) THEN
    -- Set updated_at to current time
    NEW.updated_at = timezone('utc'::text, now());
  END IF;
  
  -- If the record is verified and was updated more than one month ago, set verified to false
  IF NEW.verified = TRUE AND NEW.updated_at < (timezone('utc'::text, now()) - interval '1 month') THEN
    NEW.verified = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run expire_verification function before insert or update
CREATE TRIGGER expire_verification_trigger
  BEFORE INSERT OR UPDATE ON public.verified_accounts
  FOR EACH ROW
  EXECUTE FUNCTION expire_verification();

-- Create function to check and expire verifications daily
CREATE OR REPLACE FUNCTION check_expired_verifications()
RETURNS void AS $$
BEGIN
  UPDATE public.verified_accounts
  SET verified = FALSE
  WHERE verified = TRUE AND updated_at < (timezone('utc'::text, now()) - interval '1 month');
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run check_expired_verifications daily
-- Note: This requires pg_cron extension to be enabled
-- If pg_cron is not available, you'll need to set up an external scheduler
-- or run this function manually/through application code
SELECT cron.schedule(
  'expire-verifications',
  '0 0 * * *',  -- Run at midnight every day
  $$SELECT check_expired_verifications()$$
);