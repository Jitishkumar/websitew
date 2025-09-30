-- Add audio support to group_messages table
ALTER TABLE public.group_messages 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_public_id TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0;

-- Add comment to explain the columns
COMMENT ON COLUMN public.group_messages.audio_url IS 'URL of the audio recording uploaded to Cloudinary';
COMMENT ON COLUMN public.group_messages.audio_public_id IS 'Cloudinary public ID for the audio file';
COMMENT ON COLUMN public.group_messages.audio_duration IS 'Duration of the audio recording in seconds';

-- Create index for faster queries on audio messages
CREATE INDEX IF NOT EXISTS idx_group_messages_audio_url ON public.group_messages(audio_url) WHERE audio_url IS NOT NULL;
