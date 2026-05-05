-- Rider Phase 9C: notify buyer and seller when admin assigns a rider to a product ride booking.

create or replace function public.notify_product_ride_status_to_parties(
  p_booking_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.product_ride_bookings%rowtype;
  v_body text;
  v_title text;
  v_status text := lower(coalesce(p_status, ''));
begin
  if v_status not in ('assigned', 'accepted', 'en_route', 'delivered') then
    return;
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id;

  if not found then
    return;
  end if;

  v_body := case v_status
    when 'assigned' then 'A rider has been assigned to your product ride booking.'
    when 'accepted' then 'Your product ride booking has been accepted by the rider.'
    when 'en_route' then 'Your product ride booking is now en route.'
    when 'delivered' then 'Your product ride booking has been marked delivered.'
    else 'Your product ride booking status was updated.'
  end;

  v_title := case v_status
    when 'assigned' then 'Product ride assigned'
    else 'Product ride status updated'
  end;

  if v_booking.user_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    select
      v_booking.user_id,
      'delivery_status_changed',
      v_title,
      v_body,
      jsonb_build_object(
        'product_ride_booking_id', v_booking.id,
        'product_id', v_booking.product_id,
        'status', v_status,
        'rider_user_id', v_booking.assigned_rider_id
      )
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = v_booking.user_id
        and n.type = 'delivery_status_changed'
        and coalesce(n.data->>'product_ride_booking_id', '') = v_booking.id::text
        and coalesce(n.data->>'status', '') = v_status
        and (
          v_status is distinct from 'assigned'
          or coalesce(n.data->>'rider_user_id', '') = coalesce(v_booking.assigned_rider_id::text, '')
        )
    );
  end if;

  if v_booking.seller_user_id is not null and v_booking.seller_user_id <> v_booking.user_id then
    insert into public.notifications (user_id, type, title, body, data)
    select
      v_booking.seller_user_id,
      'delivery_status_changed',
      v_title,
      v_body,
      jsonb_build_object(
        'product_ride_booking_id', v_booking.id,
        'product_id', v_booking.product_id,
        'status', v_status,
        'rider_user_id', v_booking.assigned_rider_id
      )
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = v_booking.seller_user_id
        and n.type = 'delivery_status_changed'
        and coalesce(n.data->>'product_ride_booking_id', '') = v_booking.id::text
        and coalesce(n.data->>'status', '') = v_status
        and (
          v_status is distinct from 'assigned'
          or coalesce(n.data->>'rider_user_id', '') = coalesce(v_booking.assigned_rider_id::text, '')
        )
    );
  end if;
end;
$$;

revoke all on function public.notify_product_ride_status_to_parties(uuid, text) from public;

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

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'assigned');
end;
$$;

revoke all on function public.admin_assign_product_ride_booking(uuid, uuid) from public;
grant execute on function public.admin_assign_product_ride_booking(uuid, uuid) to authenticated;
