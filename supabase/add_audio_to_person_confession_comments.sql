-- Add audio support to person_confession_comments table
ALTER TABLE public.person_confession_comments 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_public_id TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0;

-- Add comment to explain the columns
COMMENT ON COLUMN public.person_confession_comments.audio_url IS 'URL of the audio recording uploaded to Cloudinary';
COMMENT ON COLUMN public.person_confession_comments.audio_public_id IS 'Cloudinary public ID for the audio file';
COMMENT ON COLUMN public.person_confession_comments.audio_duration IS 'Duration of the audio recording in seconds';

-- Create index for faster queries on audio comments
CREATE INDEX IF NOT EXISTS idx_person_confession_comments_audio_url ON public.person_confession_comments(audio_url) WHERE audio_url IS NOT NULL;
