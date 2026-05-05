-- Buyer-initiated cancellation: updates orders + order_items and records order_events.
-- RLS does not grant buyers direct UPDATE on orders/order_items; this RPC runs as definer
-- and enforces the same rules the buyer UI implies (OrderActionEngine: cancel only in early
-- delivery states; DB additionally blocks shipped lines and in-progress rider jobs).

create or replace function public.buyer_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
  v_st text;
begin
  select o.buyer_id, lower(trim(o.status::text))
  into v_buyer, v_st
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'This order was not found.';
  end if;

  if v_buyer is distinct from auth.uid() then
    raise exception 'You can only cancel your own orders.';
  end if;

  -- Terminal / late fulfilment order rows (mirror orders_status_check values).
  if v_st in ('cancelled', 'delivered', 'completed', 'shipped', 'in_transit', 'refunded', 'failed') then
    raise exception 'This order cannot be cancelled at this stage.';
  end if;

  -- Seller has shipped (or delivered) at line level — do not cancel after physical dispatch.
  if exists (
    select 1
    from public.order_items oi
    where oi.order_id = p_order_id
      and lower(oi.status::text) in ('shipped', 'delivered')
  ) then
    raise exception 'This order cannot be cancelled because one or more items have already shipped.';
  end if;

  -- Rider has started fulfilment (aligned with buyer UI hiding Cancel once rider is active).
  if exists (
    select 1
    from public.delivery_jobs dj
    where dj.order_id = p_order_id
      and lower(dj.status::text) in ('accepted', 'arrived_pickup', 'picked_up', 'en_route', 'delivered')
  ) then
    raise exception 'This order cannot be cancelled because delivery is already in progress.';
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  update public.order_items
  set status = 'cancelled'
  where order_id = p_order_id
    and lower(status::text) not in ('delivered', 'cancelled');

  insert into public.order_events (order_id, event_label, metadata)
  values (
    p_order_id,
    'Cancelled by buyer',
    jsonb_build_object('source', 'buyer_cancel', 'buyer_id', auth.uid())
  );
end;
$$;

comment on function public.buyer_cancel_order(uuid) is
  'Buyer cancels an order before shipped / before rider pickup pipeline advances past queued assignment.';

revoke all on function public.buyer_cancel_order(uuid) from public;
grant execute on function public.buyer_cancel_order(uuid) to authenticated;

notify pgrst, 'reload schema';
