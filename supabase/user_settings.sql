create table public.user_settings (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  dark_mode boolean null default true,
  notifications boolean null default true,
  private_account boolean null default false,
  autoplay boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_settings_pkey primary key (id),
  constraint user_settings_user_id_key unique (user_id),
  constraint user_settings_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_settings_user_id_profiles_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists user_settings_user_id_idx on public.user_settings using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_settings_user_id on public.user_settings using btree (user_id) TABLESPACE pg_default;


Policy Name
Users can insert their own settings
Table

on clause


public.user_settings
Policy Behavior

as clause

permissive
Policy Command

for clause




INSERT


Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can insert their own settings"


on "public"."user_settings"


to authenticated


with check (


  (auth.uid() = user_id)

);



Policy Name
Users can update their own settings
Table

on clause


public.user_settings
Policy Behavior

as clause

permissive
Policy Command

for clause




UPDATE


Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can update their own settings"


on "public"."user_settings"


to authenticated


using (


  (auth.uid() = user_id)

);






Policy Name
Users can view their own settings
Table

on clause


public.user_settings
Policy Behavior

as clause

permissive
Policy Command

for clause


SELECT




Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can view their own settings"


on "public"."user_settings"


to authenticated


using (


  (auth.uid() = user_id)

);