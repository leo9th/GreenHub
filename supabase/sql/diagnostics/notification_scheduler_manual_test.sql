-- Manual test setup for send-weekend-birthday-notifications
-- ---------------------------------------------------------
-- This script does NOT create auth users. It reuses existing profile rows.
-- Run in SQL editor with service role privileges.
--
-- Flow:
-- 1) Pick up to 3 existing profiles as test subjects.
-- 2) Force birthday / weekend preference scenarios.
-- 3) Clear same-period campaign markers + notifications for clean reruns.
-- 4) Invoke edge function manually (curl from terminal).
-- 5) Run verification queries below.
--
-- IMPORTANT:
-- - Leave as transaction and ROLLBACK after testing if you do not want permanent changes.
-- - Change COMMIT/ROLLBACK at bottom depending on intent.

begin;

-- A) Pick up to 3 candidate profiles.
drop table if exists _notif_test_users;
create temporary table _notif_test_users as
select
  p.id as user_id,
  row_number() over (order by p.created_at asc nulls last, p.id) as rn
from public.profiles p
where p.id is not null
limit 3;

-- Ensure we have at least one user.
-- If this returns 0 rows, create a profile/user first.
select * from _notif_test_users order by rn;

-- B) Build keys for current run period.
drop table if exists _notif_test_periods;
create temporary table _notif_test_periods as
with now_utc as (
  select now() at time zone 'utc' as ts
),
week_calc as (
  select
    extract(year from ts)::int as yyyy,
    ceil(((extract(doy from ts))::numeric) / 7)::int as ww,
    to_char(ts::date, 'YYYY-MM-DD') as day_key
  from now_utc
)
select
  format('%s-W%s', yyyy, lpad(ww::text, 2, '0')) as weekend_period_key,
  day_key as birthday_period_key
from week_calc;

select * from _notif_test_periods;

-- C) Seed deterministic preferences + birthday_date on selected users.
-- rn=1: should receive birthday + weekend (if weekend hour match)
-- rn=2: opt-out birthday
-- rn=3: opt-out weekend
update public.profiles p
set
  birthday_date = (now() at time zone 'utc')::date,
  notification_preferences = jsonb_build_object(
    'weekend_marketing', true,
    'birthday_greetings', true
  )
from _notif_test_users u
where p.id = u.user_id
  and u.rn = 1;

update public.profiles p
set
  birthday_date = (now() at time zone 'utc')::date,
  notification_preferences = jsonb_build_object(
    'weekend_marketing', true,
    'birthday_greetings', false
  )
from _notif_test_users u
where p.id = u.user_id
  and u.rn = 2;

update public.profiles p
set
  birthday_date = (now() at time zone 'utc')::date,
  notification_preferences = jsonb_build_object(
    'weekend_marketing', false,
    'birthday_greetings', true
  )
from _notif_test_users u
where p.id = u.user_id
  and u.rn = 3;

-- Force weekend-hour eligibility by aligning created_at hour to current UTC hour.
-- Only affects selected users.
update public.profiles p
set created_at = date_trunc('hour', now() at time zone 'utc')
from _notif_test_users u
where p.id = u.user_id;

-- D) Clear same-period prior markers + campaign notifications for these users.
delete from public.notification_campaign_deliveries d
using _notif_test_users u, _notif_test_periods k
where d.user_id = u.user_id
  and (
    (d.campaign_key = 'weekend_greeting' and d.period_key = k.weekend_period_key)
    or
    (d.campaign_key = 'birthday_greeting' and d.period_key = k.birthday_period_key)
  );

delete from public.notifications n
using _notif_test_users u
where n.user_id = u.user_id
  and n.type in ('weekend_greeting', 'birthday_greeting');

-- E) Show prepared state before invoking edge function.
select
  p.id,
  p.created_at,
  p.birthday_date,
  p.notification_preferences
from public.profiles p
join _notif_test_users u on u.user_id = p.id
order by u.rn;

-- --------------------------------------------------------------------
-- Invoke edge function manually (run in terminal, not SQL editor):
--
-- curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/send-weekend-birthday-notifications" \
--   -H "Content-Type: application/json" \
--   -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_TOKEN>" \
--   -H "x-scheduled-secret: <SCHEDULED_NOTIFICATIONS_SECRET>" \
--   -d "{}"
-- --------------------------------------------------------------------

-- F) Verification queries (run after invoke).
-- 1) Campaign delivery markers
select
  d.user_id,
  d.campaign_key,
  d.period_key,
  d.sent_at
from public.notification_campaign_deliveries d
join _notif_test_users u on u.user_id = d.user_id
order by d.sent_at desc;

-- 2) Notifications inserted
select
  n.user_id,
  n.type,
  n.title,
  n.body,
  n.data,
  n.created_at
from public.notifications n
join _notif_test_users u on u.user_id = n.user_id
where n.type in ('weekend_greeting', 'birthday_greeting')
order by n.created_at desc;

-- 3) Expected outcome reference:
-- rn=1 -> both campaigns allowed
-- rn=2 -> birthday blocked by opt-out
-- rn=3 -> weekend blocked by opt-out
select
  u.rn,
  p.id,
  (p.notification_preferences->>'weekend_marketing')::boolean as weekend_enabled,
  (p.notification_preferences->>'birthday_greetings')::boolean as birthday_enabled
from _notif_test_users u
join public.profiles p on p.id = u.user_id
order by u.rn;

-- Choose one:
-- commit;
rollback;

