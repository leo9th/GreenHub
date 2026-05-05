-- Marketplace checkout creates one orders row per buyer cart; each line has seller_id on order_items.
-- Legacy schemas sometimes enforce orders.seller_id NOT NULL, which breaks create_checkout_order inserts.
-- Fixes: null value in column "seller_id" of relation "orders" violates not-null constraint (23502).

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name = 'seller_id'
  ) then
    alter table public.orders alter column seller_id drop not null;
    execute $cmt$
      comment on column public.orders.seller_id is
        'Optional legacy hint for single-seller orders; marketplace checkout leaves null — use order_items.seller_id.';
    $cmt$;
  end if;
end $$;

notify pgrst, 'reload schema';
