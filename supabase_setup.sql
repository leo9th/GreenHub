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

-- Create a products table for marketplace listings
create table if not exists public.products (
  id bigint generated always as identity primary key,
  seller_id uuid references auth.users not null,
  title text not null,
  description text,
  price numeric not null,
  price_local numeric not null default 0,
  image text,
  location text,
  condition text,
  category text,
  rating numeric not null default 0,
  reviews integer not null default 0,
  seller_tier text,
  delivery_options text[],
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure missing product columns are added when updating an older schema.
alter table public.products add column if not exists category text;
alter table public.products add column if not exists condition text;
alter table public.products add column if not exists location text;
alter table public.products add column if not exists image text;
alter table public.products add column if not exists price_local numeric not null default 0;
alter table public.products add column if not exists rating numeric default 0;
alter table public.products add column if not exists reviews integer default 0;
alter table public.products add column if not exists seller_tier text;
alter table public.products add column if not exists delivery_options text[];

alter table public.products enable row level security;

create policy "Public products are viewable by everyone." on public.products
  for select using (true);

create policy "Authenticated users can insert products." on public.products
  for insert with check (auth.role() = 'authenticated');

create policy "Product owners can update their products." on public.products
  for update using (auth.uid() = seller_id);

create policy "Product owners can delete their products." on public.products
  for delete using (auth.uid() = seller_id);
