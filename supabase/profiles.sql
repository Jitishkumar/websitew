create table public.profiles (
  id uuid not null,
  username text null,
  full_name text null,
  avatar_url text null,
  bio text null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  rank integer not null,
  cover_url text null,
  gender text null,
  cover_is_video boolean null default false,
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists profiles_username_idx on public.profiles using btree (username) TABLESPACE pg_default;

create index IF not exists profiles_rank_idx on public.profiles using btree (rank) TABLESPACE pg_default;

create index IF not exists profiles_gender_idx on public.profiles using btree (gender) TABLESPACE pg_default;

create trigger assign_rank_on_insert BEFORE INSERT on profiles for EACH row
execute FUNCTION assign_user_rank ();

create trigger prevent_verified_username_change BEFORE
update on profiles for EACH row
execute FUNCTION prevent_username_change_if_verified ();

create trigger trg_profiles_propagate_rank_to_stories
after
update OF rank on profiles for EACH row
execute FUNCTION profiles_propagate_rank_to_stories ();








Policy Name
Authenticated users can read profiles (with blocking)
Table

on clause


public.profiles
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


alter policy "Authenticated users can read profiles (with blocking)"


on "public"."profiles"


to authenticated


using (

 (NOT (EXISTS ( SELECT 1
   FROM blocked_users
  WHERE (((blocked_users.blocker_id = auth.uid()) AND (blocked_users.blocked_id = profiles.id)) OR ((blocked_users.blocked_id = auth.uid()) AND (blocked_users.blocker_id = profiles.id))))))

);







Policy Name
Users can delete their own profile
Table

on clause


public.profiles
Policy Behavior

as clause

permissive
Policy Command

for clause



DELETE


Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can delete their own profile"


on "public"."profiles"


to authenticated


using (

7
  (auth.uid() = id)

);





Policy Name
Users can insert their own profile
Table

on clause


public.profiles
Policy Behavior

as clause

permissive
Policy Command

for clause



INSERT



ALL
Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can insert their own profile"


on "public"."profiles"


to authenticated


with check (


  (auth.uid() = id)

);





Policy Name
Users can update their own profile
Table

on clause


public.profiles
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


alter policy "Users can update their own profile"


on "public"."profiles"


to authenticated


using (


  (auth.uid() = id)

with check (

  (auth.uid() = id)
);


