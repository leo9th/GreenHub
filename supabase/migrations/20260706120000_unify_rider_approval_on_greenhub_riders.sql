-- Rider Phase 1: approval for presence + product rides uses public.greenhub_riders.
-- Legacy public.riders remains for older flows (e.g. delivery_requests RPCs).

begin;

-- ---------------------------------------------------------------------------
-- Helper: approved courier for GreenHub-first rider flows
-- ---------------------------------------------------------------------------

create or replace function public.fn_is_approved_greenhub_rider(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.greenhub_riders gr
    where gr.user_id = p_uid
      and gr.status = 'approved'
  );
$$;

revoke all on function public.fn_is_approved_greenhub_rider(uuid) from public;
grant execute on function public.fn_is_approved_greenhub_rider(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Presence RPCs
-- ---------------------------------------------------------------------------

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

  if not public.fn_is_approved_greenhub_rider(v_uid) then
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

revoke all on function public.rider_set_availability(boolean) from public;
grant execute on function public.rider_set_availability(boolean) to authenticated;

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

  if not public.fn_is_approved_greenhub_rider(v_uid) then
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

revoke all on function public.rider_heartbeat_location(double precision, double precision) from public;
grant execute on function public.rider_heartbeat_location(double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: nearby riders for product bookings (presence + greenhub approval)
-- ---------------------------------------------------------------------------

create or replace function public.admin_find_nearby_riders_for_product_booking(
  p_booking_id uuid,
  p_limit integer default 10,
  p_radius_km numeric default 5
)
returns table (
  rider_user_id uuid,
  distance_km numeric,
  last_seen_at timestamptz,
  is_online boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_delivery_admin() then
    raise exception 'Admin only';
  end if;

  return query
  with b as (
    select prb.id, prb.pickup_lat, prb.pickup_lng
    from public.product_ride_bookings prb
    where prb.id = p_booking_id
  ),
  riders_live as (
    select
      rp.rider_user_id,
      rp.latitude,
      rp.longitude,
      rp.last_seen_at,
      rp.is_online
    from public.rider_presence rp
    where rp.is_online = true
      and rp.latitude is not null
      and rp.longitude is not null
      and rp.last_seen_at is not null
      and rp.last_seen_at >= now() - interval '120 seconds'
      and public.fn_is_approved_greenhub_rider(rp.rider_user_id)
  ),
  calc as (
    select
      rl.rider_user_id,
      (
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(b.pickup_lat)) * cos(radians(rl.latitude)) *
            cos(radians(rl.longitude) - radians(b.pickup_lng)) +
            sin(radians(b.pickup_lat)) * sin(radians(rl.latitude))
          ))
        )
      )::numeric as distance_km,
      rl.last_seen_at,
      rl.is_online
    from riders_live rl
    cross join b
  )
  select
    c.rider_user_id,
    round(c.distance_km, 3) as distance_km,
    c.last_seen_at,
    c.is_online
  from calc c
  where c.distance_km <= p_radius_km
  order by c.distance_km asc, c.last_seen_at desc
  limit greatest(coalesce(p_limit, 10), 1);
end;
$$;

revoke all on function public.admin_find_nearby_riders_for_product_booking(uuid, integer, numeric) from public;
grant execute on function public.admin_find_nearby_riders_for_product_booking(uuid, integer, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Product ride: admin assign + rider actions (same bodies as phase-1 hardening; approval via greenhub)
-- ---------------------------------------------------------------------------

create or replace function public.admin_assign_product_ride_booking(
  p_booking_id uuid,
  p_rider_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_delivery_admin() then
    raise exception 'Admin only';
  end if;

  if not public.fn_is_approved_greenhub_rider(p_rider_user_id) then
    raise exception 'Rider is not approved';
  end if;

  update public.product_ride_bookings prb
  set
    assigned_rider_id = p_rider_user_id,
    assigned_at = now(),
    status = case
      when lower(coalesce(prb.status, '')) = 'pending' then 'assigned'
      else prb.status
    end
  where prb.id = p_booking_id;

  if not found then
    raise exception 'Ride booking not found';
  end if;
end;
$$;

revoke all on function public.admin_assign_product_ride_booking(uuid, uuid) from public;
grant execute on function public.admin_assign_product_ride_booking(uuid, uuid) to authenticated;

create or replace function public.rider_accept_product_ride_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.product_ride_bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_greenhub_rider(v_uid) then
    raise exception 'Approved rider required';
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Ride booking not found';
  end if;
  if v_booking.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can accept this booking';
  end if;

  -- Idempotent success.
  if lower(coalesce(v_booking.status, '')) = 'accepted' then
    return;
  end if;

  if lower(coalesce(v_booking.status, '')) <> 'assigned' then
    raise exception 'Invalid transition: only assigned bookings can be accepted';
  end if;

  update public.product_ride_bookings
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now())
  where id = p_booking_id;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'accepted');
end;
$$;

revoke all on function public.rider_accept_product_ride_booking(uuid) from public;
grant execute on function public.rider_accept_product_ride_booking(uuid) to authenticated;

create or replace function public.rider_mark_product_ride_en_route(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.product_ride_bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_greenhub_rider(v_uid) then
    raise exception 'Approved rider required';
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Ride booking not found';
  end if;
  if v_booking.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can mark en route';
  end if;

  -- Idempotent success.
  if lower(coalesce(v_booking.status, '')) = 'en_route' then
    return;
  end if;

  if lower(coalesce(v_booking.status, '')) <> 'accepted' then
    raise exception 'Invalid transition: only accepted bookings can be marked en route';
  end if;

  update public.product_ride_bookings
  set status = 'en_route',
      accepted_at = coalesce(accepted_at, now()),
      en_route_at = coalesce(en_route_at, now())
  where id = p_booking_id;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'en_route');
end;
$$;

revoke all on function public.rider_mark_product_ride_en_route(uuid) from public;
grant execute on function public.rider_mark_product_ride_en_route(uuid) to authenticated;

create or replace function public.rider_mark_product_ride_delivered(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.product_ride_bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_greenhub_rider(v_uid) then
    raise exception 'Approved rider required';
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Ride booking not found';
  end if;
  if v_booking.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can mark delivered';
  end if;

  -- Idempotent success.
  if lower(coalesce(v_booking.status, '')) = 'delivered' then
    return;
  end if;

  if lower(coalesce(v_booking.status, '')) <> 'en_route' then
    raise exception 'Invalid transition: only en_route bookings can be delivered';
  end if;

  update public.product_ride_bookings
  set status = 'delivered',
      accepted_at = coalesce(accepted_at, now()),
      en_route_at = coalesce(en_route_at, now()),
      delivered_at = coalesce(delivered_at, now())
  where id = p_booking_id;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'delivered');
end;
$$;

revoke all on function public.rider_mark_product_ride_delivered(uuid) from public;
grant execute on function public.rider_mark_product_ride_delivered(uuid) to authenticated;

-- admin_auto_assign_nearest_product_booking_rider delegates to admin_find_nearby + admin_assign; no change.

commit;
