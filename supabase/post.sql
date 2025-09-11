create table public.posts (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  content text null,
  image_url text null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  caption text null,
  type text null default 'text'::text,
  media_url text null,
  cloudinary_public_id text null,
  views integer null default 0,
  constraint posts_pkey primary key (id),
  constraint posts_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint posts_type_check check (
    (
      type = any (array['text'::text, 'image'::text, 'video'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_posts_type on public.posts using btree (type) TABLESPACE pg_default;

create index IF not exists idx_posts_user_id on public.posts using btree (user_id) TABLESPACE pg_default;

create index IF not exists posts_created_at_idx on public.posts using btree (created_at) TABLESPACE pg_default;

create index IF not exists posts_user_id_idx on public.posts using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_posts_created_at_type on public.posts using btree (created_at desc, type) TABLESPACE pg_default;

create index IF not exists idx_posts_views on public.posts using btree (views desc) TABLESPACE pg_default;




Policy Name
Posts visibility with blocking and privacy
Table

on clause


public.posts
Policy Behavior

as clause

permissive
Policy Command

for clause


SELECT


ALL
Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Posts visibility with blocking and privacy"


on "public"."posts"


to public


using (

 ((NOT (EXISTS ( SELECT 1
   FROM blocked_users bu
  WHERE ((bu.blocker_id = posts.user_id) AND (bu.blocked_id = auth.uid()))))) AND (NOT (EXISTS ( SELECT 1
   FROM blocked_users bu
  WHERE ((bu.blocker_id = auth.uid()) AND (bu.blocked_id = posts.user_id))))) AND ((auth.uid() = user_id) OR (NOT (EXISTS ( SELECT 1
   FROM user_settings us
  WHERE ((us.user_id = posts.user_id) AND (us.private_account = true))))) OR ((EXISTS ( SELECT 1
   FROM user_settings us
  WHERE ((us.user_id = posts.user_id) AND (us.private_account = true)))) AND (EXISTS ( SELECT 1
   FROM follows f
  WHERE ((f.following_id = posts.user_id) AND (f.follower_id = auth.uid())))))))
);






Policy Name
Users can delete their own posts
Table

on clause


public.posts
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


alter policy "Users can delete their own posts"


on "public"."posts"


to authenticated


using (

7
  (user_id = auth.uid())

);




Policy Name
Users can insert their own posts
Table

on clause


public.posts
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


alter policy "Users can insert their own posts"


on "public"."posts"


to authenticated


with check (

7
  (user_id = auth.uid())

);


Policy Name
Users can update their own posts
Table

on clause


public.posts
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


alter policy "Users can update their own posts"


on "public"."posts"


to authenticated


using (

7
  (user_id = auth.uid())

);

-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Anyone can increment views" ON "public"."posts";

-- Create a function to handle view increments securely
CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts 
  SET views = COALESCE(views, 0) + 1 
  WHERE id = post_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_post_views(UUID) TO authenticated;