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
    join public.riders r on r.user_id = rp.rider_user_id
    where rp.is_online = true
      and rp.latitude is not null
      and rp.longitude is not null
      and rp.last_seen_at is not null
      and rp.last_seen_at >= now() - interval '120 seconds'
      and lower(coalesce(r.status, '')) = 'approved'
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
