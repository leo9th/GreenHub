alter table public.product_ride_bookings
  add column if not exists assigned_rider_id uuid null references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz null,
  add column if not exists accepted_at timestamptz null,
  add column if not exists en_route_at timestamptz null,
  add column if not exists delivered_at timestamptz null;

create index if not exists product_ride_bookings_assigned_rider_idx
  on public.product_ride_bookings (assigned_rider_id, created_at desc);

drop policy if exists product_ride_bookings_select_involved on public.product_ride_bookings;
create policy product_ride_bookings_select_involved
on public.product_ride_bookings
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = seller_user_id
  or auth.uid() = assigned_rider_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);

drop policy if exists product_ride_bookings_update_involved on public.product_ride_bookings;
create policy product_ride_bookings_update_involved
on public.product_ride_bookings
for update
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = assigned_rider_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or auth.uid() = assigned_rider_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);

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

  if not exists (
    select 1
    from public.riders r
    where r.user_id = p_rider_user_id
      and lower(coalesce(r.status, '')) = 'approved'
  ) then
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
  v_status text := lower(coalesce(p_status, ''));
begin
  if v_status not in ('accepted', 'en_route', 'delivered') then
    return;
  end if;

  select * into v_booking
  from public.product_ride_bookings
  where id = p_booking_id;

  if not found then
    return;
  end if;

  v_body := case v_status
    when 'accepted' then 'Your product ride booking has been accepted by the rider.'
    when 'en_route' then 'Your product ride booking is now en route.'
    when 'delivered' then 'Your product ride booking has been marked delivered.'
    else 'Your product ride booking status was updated.'
  end;

  if v_booking.user_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    select
      v_booking.user_id,
      'delivery_status_changed',
      'Product ride status updated',
      v_body,
      jsonb_build_object(
        'product_ride_booking_id', v_booking.id,
        'product_id', v_booking.product_id,
        'status', v_status
      )
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = v_booking.user_id
        and n.type = 'delivery_status_changed'
        and coalesce(n.data->>'product_ride_booking_id', '') = v_booking.id::text
        and coalesce(n.data->>'status', '') = v_status
    );
  end if;

  if v_booking.seller_user_id is not null and v_booking.seller_user_id <> v_booking.user_id then
    insert into public.notifications (user_id, type, title, body, data)
    select
      v_booking.seller_user_id,
      'delivery_status_changed',
      'Product ride status updated',
      v_body,
      jsonb_build_object(
        'product_ride_booking_id', v_booking.id,
        'product_id', v_booking.product_id,
        'status', v_status
      )
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = v_booking.seller_user_id
        and n.type = 'delivery_status_changed'
        and coalesce(n.data->>'product_ride_booking_id', '') = v_booking.id::text
        and coalesce(n.data->>'status', '') = v_status
    );
  end if;
end;
$$;

revoke all on function public.notify_product_ride_status_to_parties(uuid, text) from public;

create or replace function public.rider_accept_product_ride_booking(
  p_booking_id uuid
)
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
    status = 'accepted',
    accepted_at = coalesce(prb.accepted_at, now())
  where prb.id = p_booking_id
    and prb.assigned_rider_id = auth.uid()
    and lower(coalesce(prb.status, '')) in ('assigned', 'accepted');

  if not found then
    raise exception 'Booking not assignable';
  end if;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'accepted');
end;
$$;

create or replace function public.rider_mark_product_ride_en_route(
  p_booking_id uuid
)
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
    status = 'en_route',
    accepted_at = coalesce(prb.accepted_at, now()),
    en_route_at = coalesce(prb.en_route_at, now())
  where prb.id = p_booking_id
    and prb.assigned_rider_id = auth.uid()
    and lower(coalesce(prb.status, '')) in ('assigned', 'accepted', 'en_route');

  if not found then
    raise exception 'Booking not eligible for en-route update';
  end if;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'en_route');
end;
$$;

create or replace function public.rider_mark_product_ride_delivered(
  p_booking_id uuid
)
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
    status = 'delivered',
    accepted_at = coalesce(prb.accepted_at, now()),
    en_route_at = coalesce(prb.en_route_at, now()),
    delivered_at = coalesce(prb.delivered_at, now())
  where prb.id = p_booking_id
    and prb.assigned_rider_id = auth.uid()
    and lower(coalesce(prb.status, '')) in ('assigned', 'accepted', 'en_route');

  if not found then
    raise exception 'Booking not eligible for delivery';
  end if;

  perform public.notify_product_ride_status_to_parties(p_booking_id, 'delivered');
end;
$$;

revoke all on function public.rider_accept_product_ride_booking(uuid) from public;
grant execute on function public.rider_accept_product_ride_booking(uuid) to authenticated;

revoke all on function public.rider_mark_product_ride_en_route(uuid) from public;
grant execute on function public.rider_mark_product_ride_en_route(uuid) to authenticated;

revoke all on function public.rider_mark_product_ride_delivered(uuid) from public;
grant execute on function public.rider_mark_product_ride_delivered(uuid) to authenticated;
