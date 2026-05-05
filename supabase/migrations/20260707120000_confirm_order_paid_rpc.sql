-- Allow admin or (POD) seller to set orders → paid so handle_orders_greenhub_delivery_job creates delivery_jobs.

begin;

create or replace function public.confirm_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ord record;
  v_st text;
  v_pm text;
  v_is_admin boolean;
  v_seller_on_order boolean;
  v_event_label text;
  v_metadata jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.status, o.payment_method
  into v_ord
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_st := lower(trim(coalesce(v_ord.status, '')));
  v_pm := lower(trim(coalesce(v_ord.payment_method, '')));

  if v_st = 'paid' then
    return;
  end if;

  if v_st not in ('pending_payment', 'needs_review') then
    raise exception 'Order cannot be marked paid from this status';
  end if;

  v_is_admin := public.fn_greenhub_is_admin(v_uid);

  select exists (
    select 1
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.seller_id = v_uid
  )
  into v_seller_on_order;

  if v_is_admin then
    null;
  elsif v_seller_on_order then
    if v_st is distinct from 'pending_payment' then
      raise exception 'Only an admin can mark orders awaiting review as paid';
    end if;
    if v_pm is distinct from 'pod' then
      raise exception 'Seller confirmation is only for pay-on-delivery orders';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  update public.orders o
  set status = 'paid'
  where o.id = p_order_id;

  if v_st = 'needs_review' and v_is_admin then
    v_event_label := 'Review Approved';
    v_metadata := jsonb_build_object(
      'source', 'admin',
      'decision', 'approved',
      'previous_status', v_st,
      'reviewed_by', v_uid,
      'actor_id', v_uid,
      'reviewed_at', now()
    );
  else
    v_event_label := 'Order marked paid';
    v_metadata := jsonb_build_object(
      'source', case when v_is_admin then 'admin' else 'seller_pod' end,
      'previous_status', v_st,
      'actor_id', v_uid
    );
  end if;

  insert into public.order_events (order_id, event_label, metadata)
  values (p_order_id, v_event_label, v_metadata);
end;
$$;

revoke all on function public.confirm_order_paid(uuid) from public;
grant execute on function public.confirm_order_paid(uuid) to authenticated;

commit;
