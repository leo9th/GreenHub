alter table public.profiles
  add column if not exists birthday date;

alter table public.profiles
  add column if not exists promo_notifications_enabled boolean not null default true;

create or replace function public.send_scheduled_notifications(
  p_run_date date default ((now() at time zone 'utc')::date),
  p_run_hour integer default extract(hour from (now() at time zone 'utc'))::integer,
  p_include_birthdays boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weekend_count integer := 0;
  v_birthday_count integer := 0;
begin
  -- Weekend reminder campaign: Fridays at 09:00 UTC.
  if extract(isodow from p_run_date) = 5 and p_run_hour = 9 then
    with inserted as (
      insert into public.notifications (user_id, type, title, body, data)
      select
        p.id,
        'promotion',
        'Weekend reminder',
        'Hello from GreenHub! Weekend is a great time to buy, sell, and book deliveries.',
        jsonb_build_object(
          'campaign', 'weekend_reminder',
          'campaign_date', p_run_date::text
        )
      from public.profiles p
      where coalesce(p.promo_notifications_enabled, true) = true
        and not exists (
          select 1
          from public.notifications n
          where n.user_id = p.id
            and n.type = 'promotion'
            and coalesce(n.data->>'campaign', '') = 'weekend_reminder'
            and coalesce(n.data->>'campaign_date', '') = p_run_date::text
        )
      returning 1
    )
    select count(*) into v_weekend_count from inserted;
  end if;

  -- Optional birthday campaign (enable by passing p_include_birthdays=true).
  if p_include_birthdays then
    with inserted as (
      insert into public.notifications (user_id, type, title, body, data)
      select
        p.id,
        'birthday',
        'Happy Birthday from GreenHub!',
        'Wishing you a wonderful day. Enjoy buying, selling, and deliveries with us.',
        jsonb_build_object(
          'campaign', 'birthday_greeting',
          'campaign_year', extract(year from p_run_date)::int
        )
      from public.profiles p
      where p.birthday is not null
        and coalesce(p.promo_notifications_enabled, true) = true
        and extract(month from p.birthday) = extract(month from p_run_date)
        and extract(day from p.birthday) = extract(day from p_run_date)
        and not exists (
          select 1
          from public.notifications n
          where n.user_id = p.id
            and n.type = 'birthday'
            and coalesce(n.data->>'campaign', '') = 'birthday_greeting'
            and coalesce(n.data->>'campaign_year', '') = extract(year from p_run_date)::text
        )
      returning 1
    )
    select count(*) into v_birthday_count from inserted;
  end if;

  return jsonb_build_object(
    'run_date', p_run_date,
    'run_hour_utc', p_run_hour,
    'weekend_inserted', v_weekend_count,
    'birthday_inserted', v_birthday_count,
    'birthdays_enabled', p_include_birthdays
  );
end;
$$;

revoke all on function public.send_scheduled_notifications(date, integer, boolean) from public;
