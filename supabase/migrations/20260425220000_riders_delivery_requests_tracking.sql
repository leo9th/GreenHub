-- Rider delivery: riders, delivery_requests, delivery_tracking (plain lat/lng).
-- Idempotent: safe if objects already exist from manual DDL.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'blocked')),
  vehicle_type text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists riders_user_id_idx on public.riders (user_id);
create index if not exists riders_status_idx on public.riders (status);

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  assigned_rider_id uuid null references auth.users (id) on delete set null,
  delivery_pin text not null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_requests_order_id_key unique (order_id)
);

create index if not exists delivery_requests_status_idx on public.delivery_requests (status);
create index if not exists delivery_requests_assigned_idx on public.delivery_requests (assigned_rider_id);

create table if not exists public.delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  delivery_request_id uuid not null references public.delivery_requests (id) on delete cascade,
  rider_user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists delivery_tracking_request_recorded_idx on public.delivery_tracking (delivery_request_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.fn_delivery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role::text, '')) = 'admin'
  );
$$;

revoke all on function public.fn_delivery_admin() from public;
grant execute on function public.fn_delivery_admin() to authenticated;

create or replace function public.fn_random_delivery_pin()
returns text
language plpgsql
as $$
declare v text;
begin
  v := lpad((floor(random() * 1000000))::int::text, 6, '0');
  if length(v) < 6 then v := lpad(v, 6, '0'); end if;
  return v;
end;
$$;

create or replace function public.trg_riders_set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists riders_set_updated_at on public.riders;
create trigger riders_set_updated_at before update on public.riders for each row execute procedure public.trg_riders_set_updated_at();

create or replace function public.trg_delivery_requests_set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists delivery_requests_set_updated_at on public.delivery_requests;
create trigger delivery_requests_set_updated_at before update on public.delivery_requests for each row execute procedure public.trg_delivery_requests_set_updated_at();

-- Paid order: one pending delivery request (PIN generated).
create or replace function public.create_delivery_request_for_paid_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_pin text;
begin
  if exists (select 1 from public.delivery_requests dr where dr.order_id = p_order_id) then
    return;
  end if;

  select lower(trim(coalesce(o.status, ''))) into v_status from public.orders o where o.id = p_order_id;
  if not found or v_status is distinct from 'paid' then
    return;
  end if;

  v_pin := public.fn_random_delivery_pin();
  insert into public.delivery_requests (order_id, status, delivery_pin)
  values (p_order_id, 'pending', v_pin);
end;
$$;

revoke all on function public.create_delivery_request_for_paid_order(uuid) from public;

create or replace function public.handle_orders_delivery_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'paid' then
      perform public.create_delivery_request_for_paid_order(new.id);
    end if;
  elsif tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'paid'
       and lower(coalesce(old.status, '')) is distinct from lower(coalesce(new.status, '')) then
      perform public.create_delivery_request_for_paid_order(new.id);
    end if;
    if lower(coalesce(new.status, '')) in ('cancelled', 'refunded', 'failed') then
      update public.delivery_requests dr
      set status = 'cancelled'
      where dr.order_id = new.id and dr.status not in ('delivered', 'cancelled');
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orders_delivery_request on public.orders;
create trigger trg_orders_delivery_request
  after insert or update of status on public.orders
  for each row execute procedure public.handle_orders_delivery_request();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.rider_apply_rider_profile(p_vehicle_type text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  insert into public.riders (user_id, status, vehicle_type)
  values (v_uid, 'pending', nullif(trim(p_vehicle_type), ''))
  on conflict (user_id) do update
    set vehicle_type = coalesce(excluded.vehicle_type, public.riders.vehicle_type),
        updated_at = now();
end;
$$;
revoke all on function public.rider_apply_rider_profile(text) from public;
grant execute on function public.rider_apply_rider_profile(text) to authenticated;

create or replace function public.admin_set_rider_table_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.fn_delivery_admin() then raise exception 'Admin only'; end if;
  if p_status not in ('pending', 'approved', 'blocked') then raise exception 'Invalid status'; end if;
  update public.riders r set status = p_status, updated_at = now() where r.user_id = p_user_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Rider row not found'; end if;
end;
$$;
revoke all on function public.admin_set_rider_table_status(uuid, text) from public;
grant execute on function public.admin_set_rider_table_status(uuid, text) to authenticated;

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
    and dr.status = 'pending'
    and dr.assigned_rider_id is null;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Request is not available to accept';
  end if;
end;
$$;
revoke all on function public.rider_accept_delivery_request(uuid) from public;
grant execute on function public.rider_accept_delivery_request(uuid) to authenticated;

create or replace function public.rider_mark_delivery_picked_up(p_request_id uuid)
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
  update public.delivery_requests dr
  set status = 'picked_up'
  where dr.id = p_request_id
    and dr.assigned_rider_id = v_uid
    and dr.status = 'assigned';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Invalid state for pickup'; end if;
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
  v_n int;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  update public.delivery_requests dr
  set status = 'delivered', delivered_at = now()
  where dr.id = p_request_id
    and dr.assigned_rider_id = v_uid
    and dr.status = 'picked_up'
    and dr.delivery_pin = nullif(trim(p_pin), '');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'PIN incorrect or invalid state'; end if;
end;
$$;
revoke all on function public.rider_mark_delivery_delivered(uuid, text) from public;
grant execute on function public.rider_mark_delivery_delivered(uuid, text) to authenticated;

create or replace function public.rider_record_delivery_tracking(
  p_request_id uuid,
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
  v_n int;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_latitude is null or p_longitude is null then raise exception 'Coordinates required'; end if;
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordinates out of range';
  end if;

  insert into public.delivery_tracking (delivery_request_id, rider_user_id, latitude, longitude)
  select dr.id, v_uid, p_latitude, p_longitude
  from public.delivery_requests dr
  where dr.id = p_request_id
    and dr.assigned_rider_id = v_uid
    and dr.status in ('assigned', 'picked_up');

  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Not allowed to record tracking for this request'; end if;
end;
$$;
revoke all on function public.rider_record_delivery_tracking(uuid, double precision, double precision) from public;
grant execute on function public.rider_record_delivery_tracking(uuid, double precision, double precision) to authenticated;

create or replace function public.admin_assign_delivery_request(p_request_id uuid, p_rider_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.fn_delivery_admin() then raise exception 'Admin only'; end if;
  if not exists (select 1 from public.riders r where r.user_id = p_rider_user_id and r.status = 'approved') then
    raise exception 'Rider is not approved';
  end if;
  update public.delivery_requests dr
  set assigned_rider_id = p_rider_user_id, status = 'assigned'
  where dr.id = p_request_id and dr.status in ('pending', 'assigned');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Request not assignable'; end if;
end;
$$;
revoke all on function public.admin_assign_delivery_request(uuid, uuid) from public;
grant execute on function public.admin_assign_delivery_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.riders enable row level security;
alter table public.delivery_requests enable row level security;
alter table public.delivery_tracking enable row level security;

drop policy if exists riders_select_own_or_admin on public.riders;
create policy riders_select_own_or_admin
  on public.riders for select to authenticated
  using (user_id = auth.uid() or public.fn_delivery_admin());

drop policy if exists riders_insert_own on public.riders;
create policy riders_insert_own
  on public.riders for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists riders_update_admin on public.riders;
create policy riders_update_admin
  on public.riders for update to authenticated
  using (public.fn_delivery_admin())
  with check (public.fn_delivery_admin());

drop policy if exists riders_update_own_pending on public.riders;
create policy riders_update_own_pending
  on public.riders for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists delivery_requests_select_parties on public.delivery_requests;
create policy delivery_requests_select_parties
  on public.delivery_requests for select to authenticated
  using (
    public.fn_delivery_admin()
    or assigned_rider_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = delivery_requests.order_id and o.buyer_id = auth.uid())
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = delivery_requests.order_id and oi.seller_id = auth.uid()
    )
  );

drop policy if exists delivery_tracking_select_parties on public.delivery_tracking;
create policy delivery_tracking_select_parties
  on public.delivery_tracking for select to authenticated
  using (
    public.fn_delivery_admin()
    or rider_user_id = auth.uid()
    or exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_tracking.delivery_request_id
        and (
          exists (select 1 from public.orders o where o.id = dr.order_id and o.buyer_id = auth.uid())
          or exists (
            select 1 from public.order_items oi
            where oi.order_id = dr.order_id and oi.seller_id = auth.uid()
          )
        )
    )
  );

grant select on public.riders to authenticated;
grant insert on public.riders to authenticated;
grant update on public.riders to authenticated;
grant select on public.delivery_requests to authenticated;
grant select on public.delivery_tracking to authenticated;
