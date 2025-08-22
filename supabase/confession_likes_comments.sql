-- Create confession_likes table with proper foreign key relationships
create table public.confession_likes (
  id uuid not null default gen_random_uuid(),
  confession_id integer not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint confession_likes_pkey primary key (id),
  constraint confession_likes_confession_id_user_id_key unique (confession_id, user_id),
  constraint confession_likes_confession_id_fkey foreign key (confession_id) references public.confessions(id) on delete cascade,
  constraint confession_likes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create indexes for better query performance
create index if not exists idx_confession_likes_confession_id on public.confession_likes using btree (confession_id);
create index if not exists idx_confession_likes_user_id on public.confession_likes using btree (user_id);

-- Enable Row Level Security
alter table public.confession_likes enable row level security;

-- Create policies
create policy "Users can view all confession likes"
  on public.confession_likes for select
  using (true);

create policy "Users can like confessions"
  on public.confession_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike confessions"
  on public.confession_likes for delete
  using (auth.uid() = user_id);

-- Create confession_comments table with proper foreign key relationships
create table public.confession_comments (
  id uuid not null default gen_random_uuid(),
  confession_id integer not null,
  user_id uuid not null,
  content text not null,
  is_anonymous boolean not null default false,
  creator_id uuid not null,
  parent_comment_id uuid null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint confession_comments_pkey primary key (id),
  constraint confession_comments_confession_id_fkey foreign key (confession_id) references public.confessions(id) on delete cascade,
  constraint confession_comments_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint confession_comments_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade,
  constraint confession_comments_parent_comment_id_fkey foreign key (parent_comment_id) references public.confession_comments(id) on delete cascade
);

-- Create indexes for better query performance
create index if not exists idx_confession_comments_confession_id on public.confession_comments using btree (confession_id);
create index if not exists idx_confession_comments_user_id on public.confession_comments using btree (user_id);
create index if not exists idx_confession_comments_parent_comment_id on public.confession_comments using btree (parent_comment_id);

-- Enable Row Level Security
alter table public.confession_comments enable row level security;

-- Create policies
create policy "Users can view all confession comments"
  on public.confession_comments for select
  using (true);

create policy "Users can create confession comments"
  on public.confession_comments for insert
  with check (
    (auth.uid() = user_id AND NOT is_anonymous) OR
    (auth.uid() = creator_id AND is_anonymous)
  );

create policy "Users can delete their own confession comments"
  on public.confession_comments for delete
  using (auth.uid() = creator_id);

-- Create functions to update likes_count and comments_count in confessions table

-- Function to update likes_count when a confession is liked/unliked
CREATE OR REPLACE FUNCTION update_confession_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.confessions
    SET likes_count = likes_count + 1
    WHERE id = NEW.confession_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.confessions
    SET likes_count = likes_count - 1
    WHERE id = OLD.confession_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update comments_count when a confession is commented on
CREATE OR REPLACE FUNCTION update_confession_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.confessions
    SET comments_count = comments_count + 1
    WHERE id = NEW.confession_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.confessions
    SET comments_count = comments_count - 1
    WHERE id = OLD.confession_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to call the functions
CREATE TRIGGER confession_likes_count_trigger
AFTER INSERT OR DELETE ON public.confession_likes
FOR EACH ROW
EXECUTE FUNCTION update_confession_likes_count();

CREATE TRIGGER confession_comments_count_trigger
AFTER INSERT OR DELETE ON public.confession_comments
FOR EACH ROW
EXECUTE FUNCTION update_confession_comments_count();