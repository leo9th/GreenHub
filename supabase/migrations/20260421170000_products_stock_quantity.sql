-- Ensure products inventory is tracked for scarcity and checkout updates.
alter table if exists public.products
add column if not exists stock_quantity integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_stock_quantity_non_negative'
  ) then
    alter table public.products
    add constraint products_stock_quantity_non_negative
    check (stock_quantity >= 0);
  end if;
end
$$;
