-- Marketplace checkout: product lines live on order_items (product_id per line).
-- Legacy schemas may enforce orders.product_id NOT NULL for single-line orders.
-- Fixes: null value in column "product_id" of relation "orders" violates not-null constraint (23502).

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'product_id'
  ) then
    alter table public.orders alter column product_id drop not null;
    execute $cmt$
      comment on column public.orders.product_id is
        'Optional legacy single-product reference; marketplace checkout uses order_items.product_id.';
    $cmt$;
  end if;
end $$;

notify pgrst, 'reload schema';
