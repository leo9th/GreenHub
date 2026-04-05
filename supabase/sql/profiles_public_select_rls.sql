-- =============================================================================
-- GreenHub: public profile directory (safe columns) + locked-down base table
-- =============================================================================
-- Run in Supabase → SQL Editor (whole script).
--
-- • Other users: read via view `profiles_public` only (no phone, address, email,
--   auto_reply, auto_reply_message, etc.).
-- • Own profile: full row via table `profiles` when id = auth.uid() (Messages,
--   AuthContext select('*'), ProfileEdit upsert).
--
-- Requires PostgreSQL 15+ (security_invoker on views). Supabase uses PG 15.
-- =============================================================================

-- Columns the app may rely on for uploads / edits (skip if already present)
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists auto_reply text;
alter table public.profiles add column if not exists bio text;

-- -----------------------------------------------------------------------------
-- View: only non-sensitive fields visible to marketplace + messaging
-- security_invoker = false → checks run as view owner (bypasses RLS on profiles
-- for this SELECT), but clients still only receive columns listed here.
-- -----------------------------------------------------------------------------
drop view if exists public.profiles_public;

create view public.profiles_public
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.gender,
  p.bio,
  p.role,
  p.state,
  p.lga,
  p.created_at,
  p.updated_at
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe profile fields. Does not expose phone, address, email, auto_reply.';

-- -----------------------------------------------------------------------------
-- Privileges: raw table for logged-in user + own row (RLS below); view for reads
-- -----------------------------------------------------------------------------
revoke all on table public.profiles from public;
grant select, insert, update on table public.profiles to authenticated;

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS on base table (full row only when it is your row)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

-- Full row read for the account owner (AuthContext select('*'), etc.)
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- Optional: tighten view if you enable RLS on views later (not required here;
-- access is already limited by the view’s column list + GRANT).
-- =============================================================================
