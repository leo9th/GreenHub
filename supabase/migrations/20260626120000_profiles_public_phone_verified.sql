-- Expose phone_verified on directory-safe view (trust signal; not PII).
-- Requires profiles.phone_verified (see 20260421130000_profiles_phone_verified.sql).

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
  coalesce(p.phone_verified, false) as phone_verified
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility; is_verified_advertiser for paid boost trust; phone_verified for SMS trust.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;
