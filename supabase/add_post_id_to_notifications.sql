-- Add post_id column to notifications table for storing additional reference data
-- This is useful for person confessions where we need both confession UUID and person ID

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS post_id text;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS notifications_post_id_idx 
ON public.notifications USING btree (post_id);

-- Update the type constraint to include new notification types
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check CHECK (
  (type)::text = ANY (
    ARRAY[
      'like'::character varying,
      'comment'::character varying,
      'follow'::character varying,
      'mention'::character varying,
      'follow_request'::character varying,
      'follow_accepted'::character varying,
      'person_confession'::character varying
    ]::text[]
  )
);

-- Add comment explaining the column
COMMENT ON COLUMN public.notifications.post_id IS 'Additional reference ID (e.g., person_id for person confessions, stored as text for flexibility)';
