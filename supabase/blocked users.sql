create table public.blocked_users (
  id uuid not null default extensions.uuid_generate_v4 (),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint blocked_users_pkey primary key (id),
  constraint blocked_users_blocker_id_blocked_id_key unique (blocker_id, blocked_id),
  constraint blocked_users_blocked_id_fkey foreign KEY (blocked_id) references profiles (id) on delete CASCADE,
  constraint blocked_users_blocker_id_fkey foreign KEY (blocker_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_blocked_users_blocker_id on public.blocked_users using btree (blocker_id) TABLESPACE pg_default;

create index IF not exists idx_blocked_users_blocked_id on public.blocked_users using btree (blocked_id) TABLESPACE pg_default;

create trigger trigger_remove_follows_on_block
after INSERT on blocked_users for EACH row
execute FUNCTION remove_follows_on_block ();


/now rls/



Policy Name
Users can block other users
Table

on clause


public.blocked_users
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


alter policy "Users can block other users"


on "public"."blocked_users"


to authenticated


with check (


  (auth.uid() = blocker_id)

);



Policy Name
Users can unblock users they've blocked
Table

on clause


public.blocked_users
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


alter policy "Users can unblock users they've blocked"


on "public"."blocked_users"


to authenticated


using (

7
  (auth.uid() = blocker_id)

);





Policy Name
Users can view their own blocked users list
Table

on clause


public.blocked_users
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


alter policy "Users can view their own blocked users list"


on "public"."blocked_users"


to authenticated


using (

7
  (auth.uid() = blocker_id)

);



after this 
create or replace function public.get_blocked_profiles(p_blocker_id uuid default auth.uid())
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from blocked_users b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = p_blocker_id;
$$;

revoke all on function public.get_blocked_profiles(uuid) from public;
grant execute on function public.get_blocked_profiles(uuid) to authenticated;