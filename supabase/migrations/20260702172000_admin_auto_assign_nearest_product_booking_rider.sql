alter table public.product_ride_bookings
  add column if not exists matched_rider_id uuid null references auth.users(id) on delete set null,
  add column if not exists matched_at timestamptz null,
  add column if not exists dispatch_mode text not null default 'manual';

create or replace function public.admin_auto_assign_nearest_product_booking_rider(
  p_booking_id uuid,
  p_radius_km numeric default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_id uuid;
begin
  if not public.fn_delivery_admin() then
    raise exception 'Admin only';
  end if;

  select t.rider_user_id
  into v_rider_id
  from public.admin_find_nearby_riders_for_product_booking(
    p_booking_id => p_booking_id,
    p_limit => 1,
    p_radius_km => p_radius_km
  ) t
  limit 1;

  if v_rider_id is null then
    raise exception 'No nearby eligible rider found';
  end if;

  perform public.admin_assign_product_ride_booking(
    p_booking_id => p_booking_id,
    p_rider_user_id => v_rider_id
  );

  update public.product_ride_bookings prb
  set
    matched_rider_id = v_rider_id,
    matched_at = now(),
    dispatch_mode = 'auto'
  where prb.id = p_booking_id;

  return v_rider_id;
end;
$$;

revoke all on function public.admin_auto_assign_nearest_product_booking_rider(uuid, numeric) from public;
grant execute on function public.admin_auto_assign_nearest_product_booking_rider(uuid, numeric) to authenticated;
