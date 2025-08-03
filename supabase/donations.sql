-- Create donations table for tracking user donations
create table if not exists public.donations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  donor_name text not null,
  amount decimal not null,
  payment_id text,
  payment_verified boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable Row Level Security
alter table public.donations enable row level security;

-- Create policies
-- Allow users to view all verified donations (for the wealthiest donors list)
create policy "Anyone can view verified donations"
  on public.donations
  for select
  to authenticated
  using (payment_verified = true);

-- Allow users to insert their own donations
create policy "Users can insert their own donations"
  on public.donations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Create index for faster sorting by amount and created_at
create index if not exists donations_amount_created_at_idx
  on public.donations (amount desc, created_at desc);

-- Add trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_donations_updated_at
  before update on public.donations
  for each row
  execute procedure public.handle_updated_at();