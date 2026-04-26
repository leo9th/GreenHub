-- Add rider-decline support while preserving existing lifecycle statuses.
-- We include "rejected" without removing statuses already used by the app/RPCs.

alter table public.delivery_requests
  drop constraint if exists delivery_requests_status_check;

alter table public.delivery_requests
  add constraint delivery_requests_status_check
  check (status in ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled', 'rejected'));

alter table public.product_ride_bookings
  drop constraint if exists product_ride_bookings_status_check;

alter table public.product_ride_bookings
  add constraint product_ride_bookings_status_check
  check (status in ('pending', 'assigned', 'accepted', 'en_route', 'delivered', 'cancelled', 'failed', 'rejected'));

create or replace function public.rider_decline_delivery_request(p_request_id uuid)
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

  -- Decline only when this rider currently owns an assigned request.
  update public.delivery_requests dr
  set
    status = 'rejected',
    assigned_rider_id = null
  where dr.id = p_request_id
    and dr.assigned_rider_id = v_uid
    and lower(coalesce(dr.status, '')) = 'assigned';

  if not found then
    raise exception 'Request not eligible for decline';
  end if;
end;
$$;

revoke all on function public.rider_decline_delivery_request(uuid) from public;
grant execute on function public.rider_decline_delivery_request(uuid) to authenticated;

-- Re-open rejected requests so other riders can accept them.
create or replace function public.rider_accept_delivery_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.riders r where r.user_id = v_uid and r.status = 'approved') then
    raise exception 'Rider is not approved';
  end if;

  update public.delivery_requests dr
  set assigned_rider_id = v_uid, status = 'assigned'
  where dr.id = p_request_id
    and dr.status in ('pending', 'rejected')
    and dr.assigned_rider_id is null;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Request is not available to accept';
  end if;
end;
$$;

revoke all on function public.rider_accept_delivery_request(uuid) from public;
grant execute on function public.rider_accept_delivery_request(uuid) to authenticated;

create or replace function public.rider_decline_product_ride_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.riders r
    where r.user_id = auth.uid()
      and lower(coalesce(r.status, '')) = 'approved'
  ) then
    raise exception 'Approved rider required';
  end if;

  update public.product_ride_bookings prb
  set
    status = 'rejected',
    assigned_rider_id = null
  where prb.id = p_booking_id
    and prb.assigned_rider_id = auth.uid()
    and lower(coalesce(prb.status, '')) in ('assigned', 'accepted');

  if not found then
    raise exception 'Booking not eligible for decline';
  end if;
end;
$$;

revoke all on function public.rider_decline_product_ride_booking(uuid) from public;
grant execute on function public.rider_decline_product_ride_booking(uuid) to authenticated;

