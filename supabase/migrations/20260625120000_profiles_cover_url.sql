-- Optional profile cover image (public URL, typically Supabase Storage).

alter table public.profiles
  add column if not exists cover_url text;

comment on column public.profiles.cover_url is
  'Optional banner/cover image URL shown on profile; same storage conventions as avatar_url.';

-- Expose on directory-safe view for other users' profiles.
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
