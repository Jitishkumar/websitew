-- Enable Row Level Security for confessions table
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to delete their own confessions
CREATE POLICY "Users can delete their own confessions"
  ON public.confessions
  FOR DELETE
  USING (
    auth.uid() = user_id AND
    NOT is_anonymous
  );

-- Policy to allow authenticated users to view all confessions and public users to view non-anonymous confessions, and creators to view their own.
CREATE POLICY "View confessions for authenticated and public non-anonymous"
  ON public.confessions
  FOR SELECT
  USING (
    auth.role() = 'authenticated' OR 
    (auth.role() = 'anon' AND is_anonymous = FALSE) OR
    auth.uid() = creator_id
  );