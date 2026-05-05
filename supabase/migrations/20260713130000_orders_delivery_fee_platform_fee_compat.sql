-- Align public.orders with create_checkout_order RPCs that insert delivery_fee and platform_fee.
-- Fixes: column "delivery_fee" of relation "orders" does not exist (42703).

alter table public.orders add column if not exists delivery_fee numeric(14, 2);
alter table public.orders add column if not exists platform_fee numeric(14, 2);

do $$
declare
  v_has_shipping_fee boolean;
begin
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'shipping_fee'
  )
  into v_has_shipping_fee;

  if v_has_shipping_fee then
    execute $q$
      update public.orders o
      set delivery_fee = coalesce(o.delivery_fee, o.shipping_fee)
      where o.delivery_fee is null
        and o.shipping_fee is not null
    $q$;
  end if;
end $$;

comment on column public.orders.delivery_fee is
  'Aggregate delivery fee at checkout; used by create_checkout_order; optional backfill from shipping_fee.';

comment on column public.orders.platform_fee is
  'Platform fee at checkout; used by create_checkout_order.';

notify pgrst, 'reload schema';
