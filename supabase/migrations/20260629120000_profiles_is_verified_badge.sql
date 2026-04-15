-- Trust: optional profile-level verified flag + badge label (runs after profiles_public cover_url migration).

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.profiles
  add column if not exists verified_badge text;

comment on column public.profiles.is_verified is
  'When true, seller is shown as verified (in addition to approved seller_verification flow).';

comment on column public.profiles.verified_badge is
  'Optional sub-label: ID, Business, or Both — shown next to verified badge when set.';

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
  coalesce(p.is_verified_advertiser, false) as is_verified_advertiser,
  coalesce(p.is_verified, false) as is_verified,
  p.verified_badge
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility; trust flags for listings.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;
