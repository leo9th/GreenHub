-- Phase 1B: product ride decline uses GreenHub rider approval (same as accept/en_route/delivered).

begin;

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

commit;
