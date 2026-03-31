-- Drop existing setup in case it was already created (e.g., from a Supabase template)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles cascade;

-- Create a table for public profiles linked to Supabase Auth
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  phone text,
  role text check (role in ('buyer', 'seller')),
  state text,
  lga text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Security
alter table profiles enable row level security;

-- Policies for security
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Trigger to automatically create a profile entry when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role, state, lga, address)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'lga',
    new.raw_user_meta_data->>'address'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
