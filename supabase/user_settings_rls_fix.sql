-- Enable RLS on the user_settings table
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict or need to be replaced
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;

-- Policy to allow authenticated users to view their own settings
CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow authenticated users to update their own settings
CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow authenticated users to insert their own settings
CREATE POLICY "Users can insert their own settings" ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
