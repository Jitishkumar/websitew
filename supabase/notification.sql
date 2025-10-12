create table public.notifications (
  id uuid not null default extensions.uuid_generate_v4 (),
  recipient_id uuid null,
  sender_id uuid null,
  type character varying not null,
  content text not null,
  reference_id uuid null,
  is_read boolean null default false,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint notifications_pkey primary key (id),
  constraint notifications_recipient_id_fkey foreign KEY (recipient_id) references auth.users (id) on delete CASCADE,
  constraint notifications_sender_id_fkey foreign KEY (sender_id) references auth.users (id) on delete CASCADE,
  constraint notifications_type_check check (
    (
      (type)::text = any (
        (
          array[
            'like'::character varying,
            'comment'::character varying,
            'follow'::character varying,
            'mention'::character varying,
            'follow_request'::character varying,
            'follow_accepted'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists notifications_recipient_id_idx on public.notifications using btree (recipient_id) TABLESPACE pg_default;

create index IF not exists notifications_created_at_idx on public.notifications using btree (created_at desc) TABLESPACE pg_default;

create trigger update_notifications_updated_at BEFORE
update on notifications for EACH row
execute FUNCTION update_updated_at_column ();



-- Function to delete notifications older than 7 days
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Deleted notifications older than 7 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run the function daily
SELECT cron.schedule(
  'delete-old-notifications',  -- name of the cron job
  '0 0 * * *',                -- run at midnight every day (cron expression)
  'SELECT delete_old_notifications();'
);





notifications

Disable RLS

Create policy

Name	Command	Applied to	Actions

Users can insert notifications
INSERT	
authenticated


Users can update their own notifications
UPDATE	
public


Users can view their own notifications
SELECT	
public

