-- Align public.orders with create_checkout_order RPCs that insert total_amount,
-- and with dynamic RPCs that prefer this column when present (information_schema order).
-- Fixes: column "total_amount" of relation "orders" does not exist (42703).

alter table public.orders add column if not exists total_amount numeric(14, 2);

do $$
declare
  v_has_total_price boolean;
  v_has_amount boolean;
begin
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'total_price'
  )
  into v_has_total_price;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'amount'
  )
  into v_has_amount;

  if v_has_total_price then
    execute $q$
      update public.orders o
      set total_amount = coalesce(o.total_amount, o.total_price)
      where o.total_amount is null
         and o.total_price is not null
    $q$;
  elsif v_has_amount then
    execute $q$
      update public.orders o
      set total_amount = coalesce(o.total_amount, o.amount)
      where o.total_amount is null
         and o.amount is not null
    $q$;
  end if;
end $$;

comment on column public.orders.total_amount is
  'Order total in major currency units; preferred by checkout RPC; backfilled from total_price/amount when added.';

notify pgrst, 'reload schema';
