-- Phase 1 rider hardening: strict transitions, authorization, idempotency.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.fn_is_approved_rider(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.riders r
    where r.user_id = p_uid
      and lower(coalesce(r.status, '')) = 'approved'
  );
$$;

revoke all on function public.fn_is_approved_rider(uuid) from public;
grant execute on function public.fn_is_approved_rider(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery request RPC hardening
-- ---------------------------------------------------------------------------

create or replace function public.rider_accept_delivery_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.delivery_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_rider(v_uid) then
    raise exception 'Rider is not approved';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Delivery request not found';
  end if;

  -- Idempotent success for repeated accepts by same rider.
  if lower(coalesce(v_req.status, '')) = 'assigned' and v_req.assigned_rider_id = v_uid then
    return;
  end if;

  if lower(coalesce(v_req.status, '')) not in ('pending', 'rejected') then
    raise exception 'Invalid transition: only pending/rejected requests can be accepted';
  end if;

  if v_req.assigned_rider_id is not null and v_req.assigned_rider_id <> v_uid then
    raise exception 'Request already assigned to another rider';
  end if;

  update public.delivery_requests
  set assigned_rider_id = v_uid,
      status = 'assigned'
  where id = p_request_id;
end;
$$;

revoke all on function public.rider_accept_delivery_request(uuid) from public;
grant execute on function public.rider_accept_delivery_request(uuid) to authenticated;

create or replace function public.rider_decline_delivery_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.delivery_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_rider(v_uid) then
    raise exception 'Rider is not approved';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Delivery request not found';
  end if;

  -- Idempotent no-op.
  if lower(coalesce(v_req.status, '')) = 'rejected' and v_req.assigned_rider_id is null then
    return;
  end if;

  if lower(coalesce(v_req.status, '')) <> 'assigned' then
    raise exception 'Invalid transition: only assigned requests can be declined';
  end if;
  if v_req.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can decline this request';
  end if;

  update public.delivery_requests
  set status = 'rejected',
      assigned_rider_id = null
  where id = p_request_id;
end;
$$;

revoke all on function public.rider_decline_delivery_request(uuid) from public;
grant execute on function public.rider_decline_delivery_request(uuid) to authenticated;

create or replace function public.rider_mark_delivery_picked_up(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.delivery_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_rider(v_uid) then
    raise exception 'Rider is not approved';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Delivery request not found';
  end if;
  if v_req.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can mark pickup';
  end if;

  -- Idempotent success.
  if lower(coalesce(v_req.status, '')) = 'picked_up' then
    return;
  end if;

  if lower(coalesce(v_req.status, '')) <> 'assigned' then
    raise exception 'Invalid transition: only assigned requests can be marked picked up';
  end if;

  update public.delivery_requests
  set status = 'picked_up'
  where id = p_request_id;
end;
$$;

revoke all on function public.rider_mark_delivery_picked_up(uuid) from public;
grant execute on function public.rider_mark_delivery_picked_up(uuid) to authenticated;

create or replace function public.rider_mark_delivery_delivered(p_request_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.delivery_requests%rowtype;
  v_pin text := nullif(trim(p_pin), '');
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.fn_is_approved_rider(v_uid) then
    raise exception 'Rider is not approved';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Delivery request not found';
  end if;
  if v_req.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can mark delivered';
  end if;

  -- Idempotent success.
  if lower(coalesce(v_req.status, '')) = 'delivered' then
    return;
  end if;

  if lower(coalesce(v_req.status, '')) <> 'picked_up' then
    raise exception 'Invalid transition: only picked_up requests can be marked delivered';
  end if;
  if v_pin is null or v_req.delivery_pin <> v_pin then
    raise exception 'PIN incorrect';
  end if;

  update public.delivery_requests
  set status = 'delivered',
      delivered_at = coalesce(delivered_at, now())
  where id = p_request_id;
end;
$$;

revoke all on function public.rider_mark_delivery_delivered(uuid, text) from public;
grant execute on function public.rider_mark_delivery_delivered(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Product ride booking RPC hardening
-- ---------------------------------------------------------------------------

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
  if not public.fn_is_approved_rider(v_uid) then
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
  if not public.fn_is_approved_rider(v_uid) then
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
  if not public.fn_is_approved_rider(v_uid) then
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

create or replace function public.rider_decline_product_ride_booking(p_booking_id uuid)
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
  if not public.fn_is_approved_rider(v_uid) then
    raise exception 'Approved rider required';
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Ride booking not found';
  end if;

  -- Idempotent no-op.
  if lower(coalesce(v_booking.status, '')) = 'rejected' and v_booking.assigned_rider_id is null then
    return;
  end if;

  if v_booking.assigned_rider_id <> v_uid then
    raise exception 'Only assigned rider can decline this booking';
  end if;
  if lower(coalesce(v_booking.status, '')) not in ('assigned', 'accepted') then
    raise exception 'Invalid transition: only assigned/accepted bookings can be declined';
  end if;

  update public.product_ride_bookings
  set status = 'rejected',
      assigned_rider_id = null
  where id = p_booking_id;
end;
$$;

revoke all on function public.rider_decline_product_ride_booking(uuid) from public;
grant execute on function public.rider_decline_product_ride_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policy tightening for product ride direct updates
-- ---------------------------------------------------------------------------

drop policy if exists product_ride_bookings_update_involved on public.product_ride_bookings;
drop policy if exists product_ride_bookings_update_own_or_admin on public.product_ride_bookings;

create policy product_ride_bookings_update_assigned_rider_or_admin
on public.product_ride_bookings
for update
to authenticated
using (
  auth.uid() = assigned_rider_id
  or public.fn_delivery_admin()
)
with check (
  auth.uid() = assigned_rider_id
  or public.fn_delivery_admin()
);

commit;
