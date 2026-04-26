-- Missing foundation for weekend/birthday notification campaigns.
-- Keeps existing fields/functions intact and adds normalized preferences + idempotent delivery log.

alter table public.profiles
  add column if not exists notification_preferences jsonb not null
    default '{"weekend_marketing": true, "birthday_greetings": true}'::jsonb;

alter table public.profiles
  add column if not exists birthday_date date;

-- Backfill birthday_date from the legacy birthday column where available.
update public.profiles
set birthday_date = birthday
where birthday_date is null
  and birthday is not null;

-- Backfill missing preference keys from legacy promo_notifications_enabled.
-- Preserve any existing keys and only ensure required flags exist.
update public.profiles
set notification_preferences = jsonb_build_object(
  'weekend_marketing',
  coalesce(
    (notification_preferences ->> 'weekend_marketing')::boolean,
    promo_notifications_enabled,
    true
  ),
  'birthday_greetings',
  coalesce(
    (notification_preferences ->> 'birthday_greetings')::boolean,
    promo_notifications_enabled,
    true
  )
)
where notification_preferences is null
   or not (notification_preferences ? 'weekend_marketing')
   or not (notification_preferences ? 'birthday_greetings');

create table if not exists public.notification_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_key text not null check (campaign_key in ('weekend_greeting', 'birthday_greeting')),
  period_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, campaign_key, period_key)
);

create index if not exists notification_campaign_deliveries_campaign_period_idx
  on public.notification_campaign_deliveries (campaign_key, period_key);

create index if not exists notification_campaign_deliveries_user_campaign_idx
  on public.notification_campaign_deliveries (user_id, campaign_key);

