-- Marketplace checkout: line prices live on order_items (unit_price / price_at_time).
-- Legacy schemas may enforce orders.unit_price_local NOT NULL.
-- Fixes: null value in column "unit_price_local" of relation "orders" violates not-null constraint (23502).

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'unit_price_local'
  ) then
    alter table public.orders alter column unit_price_local drop not null;
    execute $cmt$
      comment on column public.orders.unit_price_local is
        'Optional legacy pricing; marketplace checkout uses order_items unit/price columns.';
    $cmt$;
  end if;
end $$;

notify pgrst, 'reload schema';
