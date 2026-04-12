-- Paid boost / ads → "Verified Advertiser" on profiles (driven by successful boost_transactions).

alter table public.profiles
  add column if not exists is_verified_advertiser boolean not null default false;

comment on column public.profiles.is_verified_advertiser is
  'True once the user has at least one successful boost_transactions row (paid ads).';

-- Recreate public profile view to expose the flag for listings / cards.
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

-- Backfill from existing successful boost payments
update public.profiles p
set is_verified_advertiser = true
where exists (
  select 1
  from public.boost_transactions b
  where b.seller_id = p.id
    and b.status = 'success'
);

-- Keep flag in sync on insert / when status becomes success
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
