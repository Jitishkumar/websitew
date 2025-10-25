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
  current_latitude numeric(10, 8) null,
  current_longitude numeric(11, 8) null,
  location_updated_at timestamp without time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists profiles_username_idx on public.profiles using btree (username) TABLESPACE pg_default;

create index IF not exists profiles_rank_idx on public.profiles using btree (rank) TABLESPACE pg_default;

create index IF not exists profiles_gender_idx on public.profiles using btree (gender) TABLESPACE pg_default;

create index IF not exists idx_profiles_location on public.profiles using btree (current_latitude, current_longitude) TABLESPACE pg_default;

create index IF not exists idx_profiles_location_updated on public.profiles using btree (location_updated_at) TABLESPACE pg_default;

create trigger assign_rank_on_insert BEFORE INSERT on profiles for EACH row
execute FUNCTION assign_user_rank ();

create trigger prevent_verified_username_change BEFORE
update on profiles for EACH row
execute FUNCTION prevent_username_change_if_verified ();

create trigger trg_profiles_propagate_rank_to_stories
after
update OF rank on profiles for EACH row
execute FUNCTION profiles_propagate_rank_to_stories ();