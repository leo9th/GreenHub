-- Manual backend RPC transition tests for rider Phase 1 hardening.
-- Run in Supabase SQL editor with service-role privileges.
-- This script validates:
-- 1) valid transitions
-- 2) invalid transition rejection
-- 3) unauthorized actor rejection
-- 4) idempotency of repeated actions (accept/pickup/deliver where applicable)

begin;

-- ---------------------------------------------------------------------------
-- Seed test actors from existing profile rows (required because tables reference auth.users)
-- ---------------------------------------------------------------------------
drop table if exists _rider_phase1_users;
create temporary table _rider_phase1_users as
select
  p.id as user_id,
  row_number() over (order by p.created_at asc nulls last, p.id) as rn
from public.profiles p
where p.id is not null
limit 4;

do $$
declare
  v_count int;
begin
  select count(*) into v_count from _rider_phase1_users;
  if v_count < 4 then
    raise exception 'Need at least 4 profile/auth users for this test (buyer + seller + rider_a + rider_b)';
  end if;
end;
$$;

drop table if exists _rider_phase1_ctx;
create temporary table _rider_phase1_ctx as
select
  max(case when rn = 1 then user_id end) as buyer_uid,
  max(case when rn = 2 then user_id end) as seller_uid,
  max(case when rn = 3 then user_id end) as rider_a_uid,
  max(case when rn = 4 then user_id end) as rider_b_uid
from _rider_phase1_users;

-- Ensure rider rows exist and are approved.
insert into public.riders (user_id, status)
select rider_a_uid, 'approved' from _rider_phase1_ctx
on conflict (user_id) do update set status = 'approved', updated_at = now();

insert into public.riders (user_id, status)
select rider_b_uid, 'approved' from _rider_phase1_ctx
on conflict (user_id) do update set status = 'approved', updated_at = now();

-- ---------------------------------------------------------------------------
-- Create isolated test order + delivery request + product ride booking
-- ---------------------------------------------------------------------------
drop table if exists _rider_phase1_entities;
create temporary table _rider_phase1_entities (
  order_id uuid,
  delivery_request_id uuid,
  product_booking_id uuid
);

do $$
declare
  v_order_id uuid := gen_random_uuid();
  v_delivery_request_id uuid := gen_random_uuid();
  v_product_booking_id uuid := gen_random_uuid();
  v_buyer uuid;
  v_seller uuid;
begin
  select buyer_uid, seller_uid into v_buyer, v_seller from _rider_phase1_ctx;

  insert into public.orders (
    id, buyer_id, status, total_amount, shipping_address, created_at, updated_at
  )
  values (
    v_order_id, v_buyer, 'paid', 1000, 'Test shipping address', now(), now()
  )
  on conflict (id) do nothing;

  insert into public.delivery_requests (
    id, order_id, status, assigned_rider_id, delivery_pin
  )
  values (
    v_delivery_request_id, v_order_id, 'pending', null, '123456'
  )
  on conflict (id) do nothing;

  insert into public.product_ride_bookings (
    id, user_id, seller_user_id, product_id,
    pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    contact_phone, source, status, assigned_rider_id, assigned_at
  )
  values (
    v_product_booking_id, v_buyer, v_seller, 'test-product-id',
    'Test pickup', 6.5000, 3.3000,
    'Test dropoff', 6.5500, 3.3500,
    '08000000000', 'product_detail', 'assigned',
    (select rider_a_uid from _rider_phase1_ctx), now()
  )
  on conflict (id) do nothing;

  insert into _rider_phase1_entities(order_id, delivery_request_id, product_booking_id)
  values (v_order_id, v_delivery_request_id, v_product_booking_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- DELIVERY FLOW assertions
-- ---------------------------------------------------------------------------
do $$
declare
  v_request_id uuid := (select delivery_request_id from _rider_phase1_entities limit 1);
  v_decline_order_id uuid := gen_random_uuid();
  v_decline_request_id uuid := gen_random_uuid();
  v_buyer uuid := (select buyer_uid from _rider_phase1_ctx);
  v_rider_a uuid := (select rider_a_uid from _rider_phase1_ctx);
  v_rider_b uuid := (select rider_b_uid from _rider_phase1_ctx);
  v_status text;
begin
  -- accept: valid transition success
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_accept_delivery_request(v_request_id);
  select status into v_status from public.delivery_requests where id = v_request_id;
  if v_status <> 'assigned' then
    raise exception 'Expected assigned after accept, got %', v_status;
  end if;

  -- accept: idempotency (same rider repeat)
  perform public.rider_accept_delivery_request(v_request_id);

  -- unauthorized rejection: other rider cannot decline
  perform set_config('request.jwt.claim.sub', v_rider_b::text, true);
  begin
    perform public.rider_decline_delivery_request(v_request_id);
    raise exception 'Expected unauthorized decline to fail';
  exception when others then
    if position('Only assigned rider can decline this request' in sqlerrm) = 0 then
      raise exception 'Unexpected error for unauthorized decline: %', sqlerrm;
    end if;
  end;

  -- pickup valid
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_mark_delivery_picked_up(v_request_id);
  select status into v_status from public.delivery_requests where id = v_request_id;
  if v_status <> 'picked_up' then
    raise exception 'Expected picked_up after pickup, got %', v_status;
  end if;

  -- pickup idempotency
  perform public.rider_mark_delivery_picked_up(v_request_id);

  -- invalid transition rejection: cannot accept from picked_up
  begin
    perform public.rider_accept_delivery_request(v_request_id);
    raise exception 'Expected invalid transition accept to fail';
  exception when others then
    if position('Invalid transition' in sqlerrm) = 0 then
      raise exception 'Unexpected invalid transition error: %', sqlerrm;
    end if;
  end;

  -- deliver valid + idempotency
  perform public.rider_mark_delivery_delivered(v_request_id, '123456');
  perform public.rider_mark_delivery_delivered(v_request_id, '123456');
  select status into v_status from public.delivery_requests where id = v_request_id;
  if v_status <> 'delivered' then
    raise exception 'Expected delivered after delivery, got %', v_status;
  end if;

  -- decline flow checks:
  -- create a separate request already assigned to rider A.
  insert into public.orders (
    id, buyer_id, status, total_amount, shipping_address, created_at, updated_at
  )
  values (
    v_decline_order_id, v_buyer, 'paid', 1200, 'Decline flow address', now(), now()
  )
  on conflict (id) do nothing;

  insert into public.delivery_requests (
    id, order_id, status, assigned_rider_id, delivery_pin
  )
  values (
    v_decline_request_id, v_decline_order_id, 'assigned', v_rider_a, '654321'
  )
  on conflict (id) do nothing;

  -- unauthorized decline rejection
  perform set_config('request.jwt.claim.sub', v_rider_b::text, true);
  begin
    perform public.rider_decline_delivery_request(v_decline_request_id);
    raise exception 'Expected unauthorized decline to fail (decline scenario)';
  exception when others then
    if position('Only assigned rider can decline this request' in sqlerrm) = 0 then
      raise exception 'Unexpected unauthorized decline error: %', sqlerrm;
    end if;
  end;

  -- assigned rider decline success
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_decline_delivery_request(v_decline_request_id);
  select status into v_status from public.delivery_requests where id = v_decline_request_id;
  if v_status <> 'rejected' then
    raise exception 'Expected rejected after decline, got %', v_status;
  end if;

  -- repeated decline should fail with strict transition guard
  begin
    perform public.rider_decline_delivery_request(v_decline_request_id);
    raise exception 'Expected repeated decline to fail';
  exception when others then
    if position('Only assigned rider can decline this request' in sqlerrm) = 0
       and position('Invalid transition' in sqlerrm) = 0 then
      raise exception 'Unexpected repeated decline error: %', sqlerrm;
    end if;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- PRODUCT RIDE FLOW assertions
-- ---------------------------------------------------------------------------
do $$
declare
  v_booking_id uuid := (select product_booking_id from _rider_phase1_entities limit 1);
  v_decline_booking_id uuid := gen_random_uuid();
  v_buyer uuid := (select buyer_uid from _rider_phase1_ctx);
  v_seller uuid := (select seller_uid from _rider_phase1_ctx);
  v_rider_a uuid := (select rider_a_uid from _rider_phase1_ctx);
  v_rider_b uuid := (select rider_b_uid from _rider_phase1_ctx);
  v_status text;
begin
  -- accept valid + idempotency
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_accept_product_ride_booking(v_booking_id);
  perform public.rider_accept_product_ride_booking(v_booking_id);
  select status into v_status from public.product_ride_bookings where id = v_booking_id;
  if v_status <> 'accepted' then
    raise exception 'Expected accepted after accept, got %', v_status;
  end if;

  -- unauthorized actor rejection
  perform set_config('request.jwt.claim.sub', v_rider_b::text, true);
  begin
    perform public.rider_mark_product_ride_en_route(v_booking_id);
    raise exception 'Expected unauthorized en_route to fail';
  exception when others then
    if position('Only assigned rider can mark en route' in sqlerrm) = 0 then
      raise exception 'Unexpected unauthorized en_route error: %', sqlerrm;
    end if;
  end;

  -- en_route valid + idempotency
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_mark_product_ride_en_route(v_booking_id);
  perform public.rider_mark_product_ride_en_route(v_booking_id);
  select status into v_status from public.product_ride_bookings where id = v_booking_id;
  if v_status <> 'en_route' then
    raise exception 'Expected en_route after update, got %', v_status;
  end if;

  -- invalid transition rejection: cannot accept from en_route
  begin
    perform public.rider_accept_product_ride_booking(v_booking_id);
    raise exception 'Expected invalid transition accept to fail';
  exception when others then
    if position('Invalid transition' in sqlerrm) = 0 then
      raise exception 'Unexpected invalid transition error: %', sqlerrm;
    end if;
  end;

  -- delivered valid + idempotency
  perform public.rider_mark_product_ride_delivered(v_booking_id);
  perform public.rider_mark_product_ride_delivered(v_booking_id);
  select status into v_status from public.product_ride_bookings where id = v_booking_id;
  if v_status <> 'delivered' then
    raise exception 'Expected delivered after update, got %', v_status;
  end if;

  -- decline flow checks on separate assigned booking
  insert into public.product_ride_bookings (
    id, user_id, seller_user_id, product_id,
    pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    contact_phone, source, status, assigned_rider_id, assigned_at
  )
  values (
    v_decline_booking_id, v_buyer, v_seller, 'test-product-id-decline',
    'Decline pickup', 6.6000, 3.4000,
    'Decline dropoff', 6.6500, 3.4500,
    '08000000001', 'product_detail', 'assigned',
    v_rider_a, now()
  )
  on conflict (id) do nothing;

  -- unauthorized decline rejection
  perform set_config('request.jwt.claim.sub', v_rider_b::text, true);
  begin
    perform public.rider_decline_product_ride_booking(v_decline_booking_id);
    raise exception 'Expected unauthorized booking decline to fail';
  exception when others then
    if position('Only assigned rider can decline this booking' in sqlerrm) = 0 then
      raise exception 'Unexpected unauthorized booking decline error: %', sqlerrm;
    end if;
  end;

  -- assigned rider decline success
  perform set_config('request.jwt.claim.sub', v_rider_a::text, true);
  perform public.rider_decline_product_ride_booking(v_decline_booking_id);
  select status into v_status from public.product_ride_bookings where id = v_decline_booking_id;
  if v_status <> 'rejected' then
    raise exception 'Expected rejected booking after decline, got %', v_status;
  end if;

  -- repeated decline should fail with strict transition guard
  begin
    perform public.rider_decline_product_ride_booking(v_decline_booking_id);
    raise exception 'Expected repeated booking decline to fail';
  exception when others then
    if position('Only assigned rider can decline this booking' in sqlerrm) = 0
       and position('Invalid transition' in sqlerrm) = 0 then
      raise exception 'Unexpected repeated booking decline error: %', sqlerrm;
    end if;
  end;
end;
$$;

-- Optional debug snapshot:
select * from _rider_phase1_ctx;
select * from _rider_phase1_entities;
select id, status, assigned_rider_id from public.delivery_requests
where id = (select delivery_request_id from _rider_phase1_entities limit 1);
select id, status, assigned_rider_id, accepted_at, en_route_at, delivered_at
from public.product_ride_bookings
where id = (select product_booking_id from _rider_phase1_entities limit 1);

-- Keep DB clean by default for manual runs.
rollback;
