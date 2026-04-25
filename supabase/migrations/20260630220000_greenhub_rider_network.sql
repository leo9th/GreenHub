-- GreenHub-owned rider network (Option A): riders, jobs, assignments, events, ledger + RLS + RPCs.
-- Job lifecycle is driven by marketplace `orders` (no shadow orders).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.fn_greenhub_is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = p_uid
      and lower(coalesce(pr.role::text, '')) = 'admin'
  );
$$;

revoke all on function public.fn_greenhub_is_admin(uuid) from public;
grant execute on function public.fn_greenhub_is_admin(uuid) to authenticated;

-- v1 pricing: 70% of quoted delivery fee to rider, rest platform/ops (documented in app).
create or replace function public.compute_greenhub_rider_payout(p_quoted_fee numeric)
returns numeric(12, 2)
language sql
immutable
as $$
  select round(greatest(0, coalesce(p_quoted_fee, 0)) * 0.70, 2)::numeric(12, 2);
$$;

revoke all on function public.compute_greenhub_rider_payout(numeric) from public;
grant execute on function public.compute_greenhub_rider_payout(numeric) to authenticated;

create or replace function public.fn_greenhub_random_buyer_pin()
returns text
language plpgsql
as $$
declare
  v text;
begin
  v := lpad((floor(random() * 1000000))::int::text, 6, '0');
  if length(v) < 6 then
    v := lpad(v, 6, '0');
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.greenhub_riders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  vehicle_type text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists greenhub_riders_status_idx on public.greenhub_riders (status);

create table if not exists public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null default 'pending_dispatch'
    check (
      status in (
        'pending_dispatch',
        'assigned',
        'accepted',
        'arrived_pickup',
        'picked_up',
        'en_route',
        'delivered',
        'failed',
        'cancelled'
      )
    ),
  pickup_summary jsonb not null default '{}'::jsonb,
  dropoff jsonb not null default '{}'::jsonb,
  quoted_fee numeric(12, 2) not null default 0,
  rider_payout_amount numeric(12, 2) not null default 0,
  buyer_pin text not null,
  assigned_rider_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_jobs_order_id_key unique (order_id)
);

create index if not exists delivery_jobs_status_idx on public.delivery_jobs (status);
create index if not exists delivery_jobs_assigned_rider_idx on public.delivery_jobs (assigned_rider_id);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delivery_jobs (id) on delete cascade,
  rider_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'offered'
    check (status in ('offered', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create index if not exists delivery_assignments_job_idx on public.delivery_assignments (job_id);
create index if not exists delivery_assignments_rider_idx on public.delivery_assignments (rider_user_id);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delivery_jobs (id) on delete cascade,
  event_type text not null,
  payload jsonb null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null
);

create index if not exists delivery_events_job_idx on public.delivery_events (job_id);

create table if not exists public.rider_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  rider_user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid null references public.delivery_jobs (id) on delete set null,
  entry_type text not null check (entry_type in ('delivery_payout', 'adjustment', 'reversal')),
  amount numeric(12, 2) not null,
  currency text not null default 'NGN',
  memo text null,
  created_at timestamptz not null default now()
);

create index if not exists rider_ledger_rider_idx on public.rider_ledger_entries (rider_user_id);

-- Touch updated_at on riders
create or replace function public.trg_greenhub_riders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists greenhub_riders_set_updated_at on public.greenhub_riders;
create trigger greenhub_riders_set_updated_at
  before update on public.greenhub_riders
  for each row execute function public.trg_greenhub_riders_set_updated_at();

create or replace function public.trg_delivery_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists delivery_jobs_set_updated_at on public.delivery_jobs;
create trigger delivery_jobs_set_updated_at
  before update on public.delivery_jobs
  for each row execute function public.trg_delivery_jobs_set_updated_at();

-- ---------------------------------------------------------------------------
-- Core: create / cancel job from orders
-- ---------------------------------------------------------------------------

create or replace function public.create_delivery_job_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ord record;
  v_seller uuid;
  v_fee numeric(12, 2);
  v_payout numeric(12, 2);
  v_pin text;
  v_job_id uuid;
begin
  if exists (select 1 from public.delivery_jobs dj where dj.order_id = p_order_id) then
    return;
  end if;

  select o.id, o.buyer_id, o.shipping_address, o.delivery_fee, o.status
  into v_ord
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return;
  end if;

  if lower(coalesce(v_ord.status, '')) is distinct from 'paid' then
    return;
  end if;

  select oi.seller_id
  into v_seller
  from public.order_items oi
  where oi.order_id = p_order_id
  order by oi.created_at nulls last, oi.id
  limit 1;

  v_fee := round(coalesce(v_ord.delivery_fee, 0), 2);
  v_payout := public.compute_greenhub_rider_payout(v_fee);
  v_pin := public.fn_greenhub_random_buyer_pin();

  insert into public.delivery_jobs (
    order_id,
    status,
    pickup_summary,
    dropoff,
    quoted_fee,
    rider_payout_amount,
    buyer_pin
  )
  values (
    p_order_id,
    'pending_dispatch',
    jsonb_build_object(
      'kind', 'seller_pickup',
      'primary_seller_id', v_seller,
      'label', 'Seller pickup',
      'hint', 'Coordinate pickup with the seller; order details are in the rider app.'
    ),
    coalesce(v_ord.shipping_address, '{}'::jsonb),
    v_fee,
    v_payout,
    v_pin
  )
  returning id into v_job_id;

  insert into public.delivery_events (job_id, event_type, payload)
  values (v_job_id, 'job_created', jsonb_build_object('order_id', p_order_id));
end;
$$;

revoke all on function public.create_delivery_job_for_order(uuid) from public;
-- internal + trigger use

create or replace function public.handle_orders_greenhub_delivery_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'paid' then
      perform public.create_delivery_job_for_order(new.id);
    end if;
  elsif tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'paid'
       and lower(coalesce(old.status, '')) is distinct from lower(coalesce(new.status, '')) then
      perform public.create_delivery_job_for_order(new.id);
    end if;

    if lower(coalesce(new.status, '')) in ('cancelled', 'refunded', 'failed') then
      insert into public.delivery_events (job_id, event_type, payload)
      select dj.id, 'order_terminal', jsonb_build_object('order_status', new.status)
      from public.delivery_jobs dj
      where dj.order_id = new.id
        and dj.status not in ('delivered', 'cancelled');

      update public.delivery_jobs dj
      set status = 'cancelled'
      where dj.order_id = new.id
        and dj.status not in ('delivered', 'cancelled');
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orders_greenhub_delivery_job on public.orders;
create trigger trg_orders_greenhub_delivery_job
  after insert or update of status on public.orders
  for each row execute function public.handle_orders_greenhub_delivery_job();

-- ---------------------------------------------------------------------------
-- RPC: rider application
-- ---------------------------------------------------------------------------

create or replace function public.rider_apply_greenhub(p_vehicle_type text default null)
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

  insert into public.greenhub_riders (user_id, status, vehicle_type)
  values (v_uid, 'pending', nullif(trim(p_vehicle_type), ''))
  on conflict (user_id) do update
    set vehicle_type = coalesce(excluded.vehicle_type, public.greenhub_riders.vehicle_type),
        updated_at = now();
end;
$$;

revoke all on function public.rider_apply_greenhub(text) from public;
grant execute on function public.rider_apply_greenhub(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: admin rider approval + listing
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_greenhub_rider_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.fn_greenhub_is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'Invalid rider status';
  end if;

  update public.greenhub_riders gr
  set status = p_status, updated_at = now()
  where gr.user_id = p_user_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Rider application not found';
  end if;
end;
$$;

revoke all on function public.admin_set_greenhub_rider_status(uuid, text) from public;
grant execute on function public.admin_set_greenhub_rider_status(uuid, text) to authenticated;

create or replace function public.admin_list_greenhub_riders()
returns setof public.greenhub_riders
language sql
security definer
set search_path = public
stable
as $$
  select gr.*
  from public.greenhub_riders gr
  where public.fn_greenhub_is_admin(auth.uid())
  order by gr.created_at desc;
$$;

revoke all on function public.admin_list_greenhub_riders() from public;
grant execute on function public.admin_list_greenhub_riders() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: admin dispatch + rider flow
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_delivery_jobs()
returns setof public.delivery_jobs
language sql
security definer
set search_path = public
stable
as $$
  select dj.*
  from public.delivery_jobs dj
  where public.fn_greenhub_is_admin(auth.uid())
  order by dj.created_at desc;
$$;

revoke all on function public.admin_list_delivery_jobs() from public;
grant execute on function public.admin_list_delivery_jobs() to authenticated;

create or replace function public._greenhub_append_delivery_event(
  p_job_id uuid,
  p_type text,
  p_payload jsonb default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.delivery_events (job_id, event_type, payload, created_by)
  values (p_job_id, p_type, p_payload, p_actor);
end;
$$;

create or replace function public.admin_assign_delivery_job(p_job_id uuid, p_rider_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.delivery_jobs%rowtype;
begin
  if not public.fn_greenhub_is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  if not exists (
    select 1 from public.greenhub_riders gr
    where gr.user_id = p_rider_user_id and gr.status = 'approved'
  ) then
    raise exception 'Rider is not approved';
  end if;

  select * into v_job from public.delivery_jobs dj where dj.id = p_job_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.status not in ('pending_dispatch', 'assigned') then
    raise exception 'Job is not assignable (only queued or awaiting rider acceptance)';
  end if;

  update public.delivery_assignments da
  set status = 'cancelled', responded_at = now()
  where da.job_id = p_job_id and da.status = 'offered';

  insert into public.delivery_assignments (job_id, rider_user_id, status)
  values (p_job_id, p_rider_user_id, 'offered');

  update public.delivery_jobs dj
  set assigned_rider_id = p_rider_user_id,
      status = 'assigned'
  where dj.id = p_job_id;

  perform public._greenhub_append_delivery_event(
    p_job_id,
    'admin_assigned',
    jsonb_build_object('rider_user_id', p_rider_user_id),
    auth.uid()
  );
end;
$$;

revoke all on function public.admin_assign_delivery_job(uuid, uuid) from public;
grant execute on function public.admin_assign_delivery_job(uuid, uuid) to authenticated;

create or replace function public.rider_list_my_delivery_jobs()
returns setof public.delivery_jobs
language sql
security definer
set search_path = public
stable
as $$
  select dj.*
  from public.delivery_jobs dj
  where dj.assigned_rider_id = auth.uid()
  order by dj.updated_at desc nulls last, dj.created_at desc;
$$;

revoke all on function public.rider_list_my_delivery_jobs() from public;
grant execute on function public.rider_list_my_delivery_jobs() to authenticated;

create or replace function public.rider_accept_delivery_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.delivery_jobs%rowtype;
begin
  select * into v_job from public.delivery_jobs dj where dj.id = p_job_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.assigned_rider_id is distinct from auth.uid() then
    raise exception 'Not your assignment';
  end if;

  if v_job.status is distinct from 'assigned' then
    raise exception 'Job is not awaiting acceptance';
  end if;

  update public.delivery_assignments da
  set status = 'accepted', responded_at = now()
  where da.job_id = p_job_id
    and da.rider_user_id = auth.uid()
    and da.status = 'offered';

  update public.delivery_jobs dj
  set status = 'accepted'
  where dj.id = p_job_id;

  perform public._greenhub_append_delivery_event(p_job_id, 'rider_accepted', null, auth.uid());
end;
$$;

revoke all on function public.rider_accept_delivery_job(uuid) from public;
grant execute on function public.rider_accept_delivery_job(uuid) to authenticated;

create or replace function public.rider_advance_delivery_job(
  p_job_id uuid,
  p_next_status text,
  p_buyer_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.delivery_jobs%rowtype;
  v_cur text;
  v_next text := lower(trim(p_next_status));
begin
  select * into v_job from public.delivery_jobs dj where dj.id = p_job_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.assigned_rider_id is distinct from auth.uid() then
    raise exception 'Not your assignment';
  end if;

  v_cur := lower(v_job.status);

  if v_next not in ('arrived_pickup', 'picked_up', 'en_route', 'delivered', 'failed') then
    raise exception 'Invalid next status';
  end if;

  if v_cur in ('delivered', 'cancelled', 'failed', 'pending_dispatch') then
    raise exception 'Invalid job state transition';
  end if;

  if v_next = 'failed' then
    if v_cur not in ('assigned', 'accepted', 'arrived_pickup', 'picked_up', 'en_route') then
      raise exception 'Cannot mark failed from this state';
    end if;

    update public.delivery_jobs dj
    set status = 'failed'
    where dj.id = p_job_id;

    perform public._greenhub_append_delivery_event(
      p_job_id,
      'status_failed',
      jsonb_build_object('from', v_cur),
      auth.uid()
    );
    return;
  end if;

  if v_next = 'arrived_pickup' and v_cur is distinct from 'accepted' then
    raise exception 'Invalid transition';
  end if;
  if v_next = 'picked_up' and v_cur is distinct from 'arrived_pickup' then
    raise exception 'Invalid transition';
  end if;
  if v_next = 'en_route' and v_cur is distinct from 'picked_up' then
    raise exception 'Invalid transition';
  end if;
  if v_next = 'delivered' and v_cur is distinct from 'en_route' then
    raise exception 'Invalid transition';
  end if;

  if v_next = 'delivered' then
    if v_job.buyer_pin is distinct from nullif(trim(p_buyer_pin), '') then
      raise exception 'Buyer PIN does not match';
    end if;

    insert into public.rider_ledger_entries (
      rider_user_id, job_id, entry_type, amount, currency, memo
    )
    values (
      auth.uid(),
      p_job_id,
      'delivery_payout',
      v_job.rider_payout_amount,
      'NGN',
      'GreenHub delivery payout (v1 rule: 70% of quoted delivery fee)'
    );
  end if;

  update public.delivery_jobs dj
  set status = v_next
  where dj.id = p_job_id;

  perform public._greenhub_append_delivery_event(
    p_job_id,
    'status_' || v_next,
    jsonb_build_object('from', v_cur, 'to', v_next),
    auth.uid()
  );
end;
$$;

revoke all on function public.rider_advance_delivery_job(uuid, text, text) from public;
grant execute on function public.rider_advance_delivery_job(uuid, text, text) to authenticated;

create or replace function public.admin_list_delivery_events(p_job_id uuid)
returns setof public.delivery_events
language sql
security definer
set search_path = public
stable
as $$
  select de.*
  from public.delivery_events de
  where de.job_id = p_job_id
    and public.fn_greenhub_is_admin(auth.uid())
  order by de.created_at asc;
$$;

revoke all on function public.admin_list_delivery_events(uuid) from public;
grant execute on function public.admin_list_delivery_events(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.greenhub_riders enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;
alter table public.rider_ledger_entries enable row level security;

drop policy if exists greenhub_riders_select_own on public.greenhub_riders;
create policy greenhub_riders_select_own
  on public.greenhub_riders for select to authenticated
  using (user_id = auth.uid() or public.fn_greenhub_is_admin(auth.uid()));

drop policy if exists greenhub_riders_insert_own on public.greenhub_riders;
create policy greenhub_riders_insert_own
  on public.greenhub_riders for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists greenhub_riders_update_admin on public.greenhub_riders;
create policy greenhub_riders_update_admin
  on public.greenhub_riders for update to authenticated
  using (public.fn_greenhub_is_admin(auth.uid()))
  with check (public.fn_greenhub_is_admin(auth.uid()));

-- Allow applicants to refresh their pending row (used by rider_apply_greenhub ON CONFLICT).
drop policy if exists greenhub_riders_update_own_pending on public.greenhub_riders;
create policy greenhub_riders_update_own_pending
  on public.greenhub_riders for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists delivery_jobs_select_parties on public.delivery_jobs;
create policy delivery_jobs_select_parties
  on public.delivery_jobs for select to authenticated
  using (
    public.fn_greenhub_is_admin(auth.uid())
    or assigned_rider_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = delivery_jobs.order_id and o.buyer_id = auth.uid())
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = delivery_jobs.order_id and oi.seller_id = auth.uid()
    )
  );

drop policy if exists delivery_assignments_select_parties on public.delivery_assignments;
create policy delivery_assignments_select_parties
  on public.delivery_assignments for select to authenticated
  using (
    public.fn_greenhub_is_admin(auth.uid())
    or rider_user_id = auth.uid()
    or exists (
      select 1 from public.delivery_jobs dj
      where dj.id = delivery_assignments.job_id
        and (
          exists (select 1 from public.orders o where o.id = dj.order_id and o.buyer_id = auth.uid())
          or exists (
            select 1 from public.order_items oi
            where oi.order_id = dj.order_id and oi.seller_id = auth.uid()
          )
        )
    )
  );

drop policy if exists delivery_events_select_parties on public.delivery_events;
create policy delivery_events_select_parties
  on public.delivery_events for select to authenticated
  using (
    public.fn_greenhub_is_admin(auth.uid())
    or exists (
      select 1 from public.delivery_jobs dj
      where dj.id = delivery_events.job_id
        and (
          dj.assigned_rider_id = auth.uid()
          or exists (select 1 from public.orders o where o.id = dj.order_id and o.buyer_id = auth.uid())
          or exists (
            select 1 from public.order_items oi
            where oi.order_id = dj.order_id and oi.seller_id = auth.uid()
          )
        )
    )
  );

drop policy if exists rider_ledger_select_own on public.rider_ledger_entries;
create policy rider_ledger_select_own
  on public.rider_ledger_entries for select to authenticated
  using (
    rider_user_id = auth.uid()
    or public.fn_greenhub_is_admin(auth.uid())
  );

grant select on public.greenhub_riders to authenticated;
grant select on public.delivery_jobs to authenticated;
grant select on public.delivery_assignments to authenticated;
grant select on public.delivery_events to authenticated;
grant select on public.rider_ledger_entries to authenticated;
grant insert on public.greenhub_riders to authenticated;
grant update on public.greenhub_riders to authenticated;
