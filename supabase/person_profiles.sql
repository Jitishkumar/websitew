create table public.person_profiles (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  profile_image text null,
  bio text null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  created_by uuid null,
  constraint person_profiles_pkey primary key (id),
  constraint person_profiles_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null
) TABLESPACE pg_default;