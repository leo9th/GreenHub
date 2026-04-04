-- Public hire directory (not GreenHub HR): visitors search for artisans/workers; contact is direct between hirer and profile owner.

create table if not exists public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  phone text not null,
  email text not null,
  city_state text not null,
  headline text not null,
  trade_category text not null,
  skills_summary text not null,
  years_experience numeric(6, 1),
  availability text not null,
  education_level text,
  languages text,
  expected_pay text,
  portfolio_url text,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_profiles_list_idx on public.worker_profiles (status, trade_category, created_at desc);

comment on table public.worker_profiles is 'Labour/staff availability listings; employers browse active rows and contact by phone/email.';

alter table public.worker_profiles enable row level security;

drop policy if exists worker_profiles_public_read on public.worker_profiles;
create policy worker_profiles_public_read on public.worker_profiles for select
  using (status = 'active');

drop policy if exists worker_profiles_owner_read on public.worker_profiles;
create policy worker_profiles_owner_read on public.worker_profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists worker_profiles_insert on public.worker_profiles;
create policy worker_profiles_insert on public.worker_profiles for insert to anon, authenticated
  with check (true);

drop policy if exists worker_profiles_update_own on public.worker_profiles;
create policy worker_profiles_update_own on public.worker_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists worker_profiles_delete_own on public.worker_profiles;
create policy worker_profiles_delete_own on public.worker_profiles for delete to authenticated
  using (user_id = auth.uid());
