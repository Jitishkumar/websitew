create table public.user_push_tokens (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  push_token text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_push_tokens_pkey primary key (id),
  constraint user_push_tokens_user_id_key unique (user_id),
  constraint user_push_tokens_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_push_tokens_user_id on public.user_push_tokens using btree (user_id) TABLESPACE pg_default;





Policy Name
Users can insert their own push tokens
Table

on clause


public.user_push_tokens
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


alter policy "Users can insert their own push tokens"


on "public"."user_push_tokens"


to public


with check (

7
  (auth.uid() = user_id)

);







Policy Name
Users can update their own push tokens
Table

on clause


public.user_push_tokens
Policy Behavior

as clause

permissive
Policy Command

for clause

UPDATE

Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can update their own push tokens"


on "public"."user_push_tokens"


to public


using (


  (auth.uid() = user_id)

);





Policy Name
Users can view their own push tokens
Table

on clause


public.user_push_tokens
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


alter policy "Users can view their own push tokens"


on "public"."user_push_tokens"


to public


using (

7
  (auth.uid() = user_id)

);


