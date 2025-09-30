-- Add audio support to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_public_id TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN public.messages.audio_url IS 'URL of the audio recording uploaded to Cloudinary';
COMMENT ON COLUMN public.messages.audio_public_id IS 'Cloudinary public ID for the audio file';
COMMENT ON COLUMN public.messages.audio_duration IS 'Duration of the audio recording in seconds';
COMMENT ON COLUMN public.messages.cloudinary_public_id IS 'Cloudinary public ID for media files (images/videos)';

-- Create index for faster queries on audio messages
CREATE INDEX IF NOT EXISTS idx_messages_audio_url ON public.messages(audio_url) WHERE audio_url IS NOT NULL;

-- Create index for media messages
CREATE INDEX IF NOT EXISTS idx_messages_media_url ON public.messages(media_url) WHERE media_url IS NOT NULL;
