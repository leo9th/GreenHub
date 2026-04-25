alter table public.profiles
  add column if not exists sound_notifications boolean not null default true;

create or replace function public.notify_order_sellers_payment_received(
  p_order_id uuid,
  p_payment_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select
    oi.seller_id,
    'payment_received',
    'Payment received',
    'A buyer payment was confirmed for your order.',
    jsonb_build_object(
      'order_id', p_order_id,
      'payment_reference', p_payment_reference
    )
  from (
    select distinct seller_id
    from public.order_items
    where order_id = p_order_id
      and seller_id is not null
  ) oi
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = oi.seller_id
      and n.type = 'payment_received'
      and coalesce(n.data->>'order_id', '') = p_order_id::text
  );
end;
$$;

revoke all on function public.notify_order_sellers_payment_received(uuid, text) from public;

create or replace function public.trg_orders_payment_received_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'paid' then
      perform public.notify_order_sellers_payment_received(new.id, new.payment_reference);
    end if;
  elsif tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'paid'
       and lower(coalesce(old.status, '')) is distinct from lower(coalesce(new.status, '')) then
      perform public.notify_order_sellers_payment_received(new.id, new.payment_reference);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orders_payment_received_notification on public.orders;
create trigger trg_orders_payment_received_notification
  after insert or update of status on public.orders
  for each row execute function public.trg_orders_payment_received_notification();

create or replace function public.notify_delivery_assignment_to_rider(
  p_order_id uuid,
  p_job_id uuid,
  p_rider_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rider_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select
    p_rider_user_id,
    'delivery_job_assigned',
    'New delivery assigned',
    'You have been assigned a delivery job. Open Rider Dashboard to accept it.',
    jsonb_build_object(
      'order_id', p_order_id,
      'job_id', p_job_id
    )
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = p_rider_user_id
      and n.type = 'delivery_job_assigned'
      and coalesce(n.data->>'job_id', '') = coalesce(p_job_id::text, '')
      and coalesce(n.data->>'order_id', '') = coalesce(p_order_id::text, '')
  );
end;
$$;

revoke all on function public.notify_delivery_assignment_to_rider(uuid, uuid, uuid) from public;

create or replace function public.notify_delivery_status_to_buyer(
  p_order_id uuid,
  p_delivery_ref_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
begin
  select o.buyer_id into v_buyer_id
  from public.orders o
  where o.id = p_order_id;

  if v_buyer_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select
    v_buyer_id,
    'delivery_status_changed',
    'Delivery status updated',
    'Your delivery is now ' || replace(lower(coalesce(p_status, 'updated')), '_', ' ') || '.',
    jsonb_build_object(
      'order_id', p_order_id,
      'delivery_id', p_delivery_ref_id,
      'status', lower(coalesce(p_status, ''))
    )
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = v_buyer_id
      and n.type = 'delivery_status_changed'
      and coalesce(n.data->>'order_id', '') = p_order_id::text
      and coalesce(n.data->>'delivery_id', '') = coalesce(p_delivery_ref_id::text, '')
      and coalesce(n.data->>'status', '') = lower(coalesce(p_status, ''))
  );
end;
$$;

revoke all on function public.notify_delivery_status_to_buyer(uuid, uuid, text) from public;

create or replace function public.trg_delivery_jobs_notification_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_rider_id is not null then
      perform public.notify_delivery_assignment_to_rider(new.order_id, new.id, new.assigned_rider_id);
    end if;
    perform public.notify_delivery_status_to_buyer(new.order_id, new.id, new.status);
  elsif tg_op = 'UPDATE' then
    if new.assigned_rider_id is distinct from old.assigned_rider_id and new.assigned_rider_id is not null then
      perform public.notify_delivery_assignment_to_rider(new.order_id, new.id, new.assigned_rider_id);
    end if;
    if lower(coalesce(new.status, '')) is distinct from lower(coalesce(old.status, '')) then
      perform public.notify_delivery_status_to_buyer(new.order_id, new.id, new.status);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_jobs'
      and column_name = 'status'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_jobs'
      and column_name = 'assigned_rider_id'
  ) then
    execute 'drop trigger if exists trg_delivery_jobs_notification_events on public.delivery_jobs';
    execute 'create trigger trg_delivery_jobs_notification_events after insert or update of status, assigned_rider_id on public.delivery_jobs for each row execute function public.trg_delivery_jobs_notification_events()';
  end if;
end
$$;

create or replace function public.trg_delivery_requests_notification_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_rider_id is not null then
      perform public.notify_delivery_assignment_to_rider(new.order_id, new.id, new.assigned_rider_id);
    end if;
    perform public.notify_delivery_status_to_buyer(new.order_id, new.id, new.status);
  elsif tg_op = 'UPDATE' then
    if new.assigned_rider_id is distinct from old.assigned_rider_id and new.assigned_rider_id is not null then
      perform public.notify_delivery_assignment_to_rider(new.order_id, new.id, new.assigned_rider_id);
    end if;
    if lower(coalesce(new.status, '')) is distinct from lower(coalesce(old.status, '')) then
      perform public.notify_delivery_status_to_buyer(new.order_id, new.id, new.status);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_requests'
      and column_name = 'status'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_requests'
      and column_name = 'assigned_rider_id'
  ) then
    execute 'drop trigger if exists trg_delivery_requests_notification_events on public.delivery_requests';
    execute 'create trigger trg_delivery_requests_notification_events after insert or update of status, assigned_rider_id on public.delivery_requests for each row execute function public.trg_delivery_requests_notification_events()';
  end if;
end
$$;
