-- Table to store verification documents and status
CREATE TABLE public.verified_accounts (
  id uuid not null,
  username text not null,
  document_url text not null,
  selfie_url text not null,
  verified boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  CONSTRAINT verified_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT verified_accounts_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS verified_accounts_username_idx ON public.verified_accounts USING btree (username);

-- Function to update the timestamp when a record is updated
CREATE OR REPLACE FUNCTION update_verified_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the timestamp when a record is updated
CREATE TRIGGER set_verified_accounts_updated_at
BEFORE UPDATE ON verified_accounts
FOR EACH ROW
EXECUTE FUNCTION update_verified_accounts_updated_at();