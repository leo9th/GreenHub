-- GreenHub — profile stack for SQL Editor (copy/paste whole file)
-- Run once on a database that already has: public.profiles, public.boost_transactions
-- (boost table comes from migration 20260405120000_product_boost_system.sql)
--
-- Order matches repo migrations:
--   engagement (profile columns only) → verified advertiser → profile_follows →
--   list RPCs → cover_url + final profiles_public

-- =============================================================================
-- From 20260420120000_engagement_notifications_presence.sql (profile columns)
-- =============================================================================
alter table public.profiles add column if not exists show_phone_on_profile boolean not null default false;
alter table public.profiles add column if not exists show_email_on_profile boolean not null default false;
alter table public.profiles add column if not exists last_active timestamptz default now();

comment on column public.profiles.show_phone_on_profile is 'When true, phone is shown on public profile / contact.';
comment on column public.profiles.show_email_on_profile is 'When true, email is shown on public profile / contact.';

-- =============================================================================
-- 20260518120000_profiles_verified_advertiser.sql
-- =============================================================================
alter table public.profiles
  add column if not exists is_verified_advertiser boolean not null default false;

comment on column public.profiles.is_verified_advertiser is
  'True once the user has at least one successful boost_transactions row (paid ads).';

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
  p.state,
  p.lga,
  p.created_at,
  p.updated_at,
  p.last_active,
  case when coalesce(p.show_phone_on_profile, false) then p.phone else null end as phone,
  case when coalesce(p.show_email_on_profile, false) then p.email else null end as public_email,
  coalesce(p.is_verified_advertiser, false) as is_verified_advertiser
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility; is_verified_advertiser for paid boost trust.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;

update public.profiles p
set is_verified_advertiser = true
where exists (
  select 1
  from public.boost_transactions b
  where b.seller_id = p.id
    and b.status = 'success'
);

create or replace function public.sync_verified_advertiser_from_boost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'success' and new.seller_id is not null then
    update public.profiles
    set is_verified_advertiser = true
    where id = new.seller_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_sync_verified_advertiser on public.boost_transactions;
create trigger trigger_sync_verified_advertiser
  after insert or update of status, seller_id on public.boost_transactions
  for each row
  execute function public.sync_verified_advertiser_from_boost();

-- =============================================================================
-- 20260428120000_profile_follows.sql
-- =============================================================================
create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);

create index if not exists profile_follows_following_id_idx on public.profile_follows (following_id);
create index if not exists profile_follows_follower_id_idx on public.profile_follows (follower_id);

comment on table public.profile_follows is 'Directed follow edges: follower_id follows following_id.';

alter table public.profile_follows enable row level security;

drop policy if exists "profile_follows_insert_own" on public.profile_follows;
create policy "profile_follows_insert_own"
  on public.profile_follows for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
  on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

drop policy if exists "profile_follows_select_involved" on public.profile_follows;
create policy "profile_follows_select_involved"
  on public.profile_follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

create or replace function public.profile_follower_count(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.profile_follows where following_id = p_user_id;
$$;

create or replace function public.profile_following_count(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.profile_follows where follower_id = p_user_id;
$$;

comment on function public.profile_follower_count is 'Number of users following p_user_id; callable without seeing individual follower rows.';
comment on function public.profile_following_count is 'Number of users p_user_id follows.';

grant execute on function public.profile_follower_count(uuid) to anon, authenticated;
grant execute on function public.profile_following_count(uuid) to anon, authenticated;

grant select, insert, delete on table public.profile_follows to authenticated;

-- =============================================================================
-- 20260622120000_profile_follow_list_rpcs.sql
-- =============================================================================
create or replace function public.list_profile_followers(p_user_id uuid)
returns table (follower_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select pf.follower_id, pf.created_at
  from public.profile_follows pf
  where pf.following_id = p_user_id
  order by pf.created_at desc;
$$;

create or replace function public.list_profile_following(p_user_id uuid)
returns table (following_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select pf.following_id, pf.created_at
  from public.profile_follows pf
  where pf.follower_id = p_user_id
  order by pf.created_at desc;
$$;

comment on function public.list_profile_followers(uuid) is
  'Users who follow p_user_id; ordered newest first.';
comment on function public.list_profile_following(uuid) is
  'Users whom p_user_id follows; ordered newest first.';

grant execute on function public.list_profile_followers(uuid) to authenticated;
grant execute on function public.list_profile_following(uuid) to authenticated;

-- =============================================================================
-- 20260625120000_profiles_cover_url.sql
-- =============================================================================
alter table public.profiles
  add column if not exists cover_url text;

comment on column public.profiles.cover_url is
  'Optional banner/cover image URL shown on profile; same storage conventions as avatar_url.';

drop view if exists public.profiles_public;
create view public.profiles_public
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.cover_url,
  p.gender,
  p.bio,
  p.state,
  p.lga,
  p.created_at,
  p.updated_at,
  p.last_active,
  case when coalesce(p.show_phone_on_profile, false) then p.phone else null end as phone,
  case when coalesce(p.show_email_on_profile, false) then p.email else null end as public_email,
  coalesce(p.is_verified_advertiser, false) as is_verified_advertiser
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility; is_verified_advertiser for paid boost trust.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;
