-- GreenHub: one-way follows between members (social layer).
-- Run via supabase db push / migration pipeline.

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

-- Members can create/delete only their own follow relationships.
drop policy if exists "profile_follows_insert_own" on public.profile_follows;
create policy "profile_follows_insert_own"
  on public.profile_follows for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
  on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

-- Each user can read rows where they are the follower or the person being followed
-- (enough to know "am I following X?" without exposing everyone who follows X).
drop policy if exists "profile_follows_select_involved" on public.profile_follows;
create policy "profile_follows_select_involved"
  on public.profile_follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- Public aggregate counts (no leak of follower lists to unrelated users).
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
