create table if not exists public.rider_presence (
  rider_user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  latitude double precision null,
  longitude double precision null,
  last_seen_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rider_presence_online_seen_idx
  on public.rider_presence (is_online, last_seen_at desc);

create or replace function public.trg_rider_presence_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rider_presence_set_updated_at on public.rider_presence;
create trigger rider_presence_set_updated_at
before update on public.rider_presence
for each row execute function public.trg_rider_presence_set_updated_at();

create or replace function public.rider_set_availability(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.riders r
    where r.user_id = v_uid
      and lower(coalesce(r.status, '')) = 'approved'
  ) then
    raise exception 'Approved rider required';
  end if;

  insert into public.rider_presence (rider_user_id, is_online, last_seen_at)
  values (v_uid, p_is_online, case when p_is_online then now() else null end)
  on conflict (rider_user_id) do update
  set
    is_online = excluded.is_online,
    last_seen_at = case when excluded.is_online then now() else null end,
    latitude = case when excluded.is_online then public.rider_presence.latitude else null end,
    longitude = case when excluded.is_online then public.rider_presence.longitude else null end,
    updated_at = now();
end;
$$;

create or replace function public.rider_heartbeat_location(
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Coordinates required';
  end if;
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordinates out of range';
  end if;

  if not exists (
    select 1
    from public.riders r
    where r.user_id = v_uid
      and lower(coalesce(r.status, '')) = 'approved'
  ) then
    raise exception 'Approved rider required';
  end if;

  insert into public.rider_presence (rider_user_id, is_online, latitude, longitude, last_seen_at)
  values (v_uid, true, p_latitude, p_longitude, now())
  on conflict (rider_user_id) do update
  set
    is_online = true,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.rider_set_availability(boolean) from public;
grant execute on function public.rider_set_availability(boolean) to authenticated;

revoke all on function public.rider_heartbeat_location(double precision, double precision) from public;
grant execute on function public.rider_heartbeat_location(double precision, double precision) to authenticated;

alter table public.rider_presence enable row level security;

drop policy if exists rider_presence_select_own_or_admin on public.rider_presence;
create policy rider_presence_select_own_or_admin
on public.rider_presence
for select
to authenticated
using (
  rider_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);

drop policy if exists rider_presence_upsert_own on public.rider_presence;
create policy rider_presence_upsert_own
on public.rider_presence
for insert
to authenticated
with check (rider_user_id = auth.uid());

drop policy if exists rider_presence_update_own on public.rider_presence;
create policy rider_presence_update_own
on public.rider_presence
for update
to authenticated
using (rider_user_id = auth.uid())
with check (rider_user_id = auth.uid());

grant select, insert, update on public.rider_presence to authenticated;
