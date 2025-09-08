create table public.messages (
  id uuid not null default extensions.uuid_generate_v4 (),
  conversation_id text not null,
  sender_id uuid not null,
  receiver_id uuid not null,
  content text not null,
  media_url text null,
  media_type text null,
  created_at timestamp with time zone null default now(),
  read boolean null default false,
  updated_at timestamp with time zone null default now(),
  metadata jsonb null,
  constraint messages_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists messages_created_at_idx on public.messages using btree (created_at) TABLESPACE pg_default;

create index IF not exists messages_sender_id_idx on public.messages using btree (sender_id) TABLESPACE pg_default;

create index IF not exists idx_messages_read_status on public.messages using btree (conversation_id, receiver_id, read) TABLESPACE pg_default;

create index IF not exists idx_messages_conversation_id on public.messages using btree (conversation_id) TABLESPACE pg_default;

-- Update existing messages to set proper media_type based on media_url
UPDATE public.messages 
SET media_type = CASE 
  WHEN media_url IS NOT NULL AND (
    media_url ILIKE '%.mp4%' OR 
    media_url ILIKE '%/video/%' OR 
    media_url ILIKE '%video%'
  ) THEN 'video'
  WHEN media_url IS NOT NULL AND (
    media_url ILIKE '%.jpg%' OR 
    media_url ILIKE '%.jpeg%' OR 
    media_url ILIKE '%.png%' OR 
    media_url ILIKE '%/image/%' OR 
    media_url ILIKE '%image%'
  ) THEN 'image'
  WHEN media_url IS NOT NULL THEN 'video' -- Default Cloudinary URLs to video
  ELSE NULL
END
WHERE media_type IS NULL AND media_url IS NOT NULL;






create trigger on_message_read_status_update
after
update OF read on messages for EACH row when (old.read is distinct from new.read)
execute FUNCTION handle_message_read_status ();

create trigger set_updated_at_trigger BEFORE
update on messages for EACH row
execute FUNCTION set_updated_at ();

create trigger update_last_active_on_message_send
after INSERT on messages for EACH row
execute FUNCTION update_last_active ();



Update policy: Users can delete their own messages

View policy details


Policy Name
Users can delete their own messages
Table

on clause


public.messages
Policy Behavior

as clause

permissive
Policy Command

for clause




DELETE


Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can delete their own messages"


on "public"."messages"


to public


using (


  (auth.uid() = sender_id)

);




Update policy: Users can insert their own messages

View policy details


Policy Name
Users can insert their own messages
Table

on clause


public.messages
Policy Behavior

as clause

permissive
Policy Command

for clause




INSERT




Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can insert their own messages"


on "public"."messages"


to public


with check (


  (auth.uid() = sender_id)

);



Policy Name
Users can read their own conversations
Table

on clause


public.messages
Policy Behavior

as clause

permissive
Policy Command

for clause


SELECT

Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can read their own conversations"


on "public"."messages"


to public


using (


  ((auth.uid() = sender_id) OR (auth.uid() = receiver_id))

);




Policy Name
Users can update their received messages
Table

on clause


public.messages
Policy Behavior

as clause

permissive
Policy Command

for clause



UPDATE




to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can update their received messages"


on "public"."messages"


to public


using (


  (auth.uid() = receiver_id)

);




UPDATE public.messages 
SET media_type = CASE 
  WHEN media_url ILIKE '%.mp4%' OR 
       (media_url ILIKE 'res.cloudinary.com/%/video/%') OR
       (media_url ILIKE '%/upload/%/v%/%') THEN 'video'
  WHEN media_url ILIKE '%.jpg%' OR 
       media_url ILIKE '%.jpeg%' OR 
       media_url ILIKE '%.png%' OR 
       media_url ILIKE '%.gif%' OR
       media_url ILIKE '%.webp%' OR
       (media_url ILIKE 'res.cloudinary.com/%/image/%') OR
       (media_url ILIKE '%/upload/%/i%/%') THEN 'image'
  ELSE 'image'
END
WHERE media_url IS NOT NULL;