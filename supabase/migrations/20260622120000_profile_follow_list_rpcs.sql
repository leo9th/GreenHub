-- Twitter-style follower / following lists: RLS on profile_follows only exposes rows
-- where the reader is involved; these SECURITY DEFINER RPCs return public list data safely.

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
