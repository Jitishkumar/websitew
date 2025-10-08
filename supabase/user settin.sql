create table public.user_message_settings (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  show_online_status boolean null default true,
  show_read_receipts boolean null default true,
  last_active timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_message_settings_pkey primary key (id),
  constraint user_message_settings_user_id_key unique (user_id),
  constraint user_message_settings_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_message_settings_user_id on public.user_message_settings using btree (user_id) TABLESPACE pg_default;





user_message_settings

Disable RLS

Create policy

Name	Command	Applied to	Actions

Users can insert their own message settings
INSERT	
public


Users can update their own message settings
UPDATE	
public


Users can view their own message settings
SELECT	
public