create table public.stories (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  media_url text null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  expires_at timestamp with time zone null default (
    timezone ('utc'::text, now()) + '24:00:00'::interval
  ),
  type text not null,
  cloudinary_public_id text not null,
  followers_only boolean not null default true,
  story_group_id uuid not null default gen_random_uuid (),
  is_first_story boolean not null default true,
  user_rank integer null,
  constraint stories_pkey primary key (id),
  constraint stories_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint stories_type_check check (
    (type = any (array['image'::text, 'video'::text]))
  )
) TABLESPACE pg_default;

create index IF not exists idx_stories_group on public.stories using btree (story_group_id) TABLESPACE pg_default;

create index IF not exists idx_stories_story_group_id on public.stories using btree (story_group_id) TABLESPACE pg_default;

create index IF not exists stories_created_at_idx on public.stories using btree (created_at) TABLESPACE pg_default;

create index IF not exists stories_user_id_idx on public.stories using btree (user_id) TABLESPACE pg_default;

create trigger trg_stories_set_user_rank BEFORE INSERT
or
update OF user_id on stories for EACH row
execute FUNCTION stories_set_user_rank ();

create trigger trigger_delete_expired_stories
after INSERT
or
update on stories for EACH STATEMENT
execute FUNCTION delete_expired_stories ();




Policy Name
Stories visibility with rank 1 and block check
Table

on clause


public.stories
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


alter policy "Stories visibility with rank 1 and block check"


on "public"."stories"


to public


using (


  ((followers_only = false) OR (EXISTS ( SELECT 1
   FROM follows
  WHERE ((follows.following_id = stories.user_id) AND (follows.follower_id = auth.uid())))) OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = stories.user_id) AND (profiles.rank = 1)))) AND (NOT (EXISTS ( SELECT 1
   FROM blocked_users
  WHERE ((blocked_users.blocker_id = stories.user_id) AND (blocked_users.blocked_id = auth.uid())))))))

);



Policy Name
Users can delete their own stories
Table

on clause


public.stories
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


alter policy "Users can delete their own stories"


on "public"."stories"


to public


using (


  (auth.uid() = user_id)

);






Policy Name
Users can insert their own stories
Table

on clause


public.stories
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


alter policy "Users can insert their own stories"


on "public"."stories"


to public


with check (


  (auth.uid() = user_id)

);






Policy Name
Users can update their own stories
Table

on clause


public.stories
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


alter policy "Users can update their own stories"


on "public"."stories"


to public


using (


  (auth.uid() = user_id)

);





Policy Name
Users can view all stories
Table

on clause


public.stories
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


alter policy "Users can view all stories"


on "public"."stories"


to public


using (


  true

);





