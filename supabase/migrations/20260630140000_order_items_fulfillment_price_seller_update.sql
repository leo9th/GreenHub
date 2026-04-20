-- Checkout snapshots + seller fulfillment updates
alter table public.order_items
  add column if not exists price_at_time numeric(10, 2);

alter table public.order_items
  add column if not exists fulfillment_type text;

-- Backfill from legacy columns when present
update public.order_items
set price_at_time = unit_price
where price_at_time is null
  and unit_price is not null;

drop policy if exists "order_items_update_seller_own" on public.order_items;
create policy "order_items_update_seller_own"
  on public.order_items for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Timeline rows when sellers mark items shipped (buyer policy already covers buyer inserts)
drop policy if exists "order_events_insert_seller_line_items" on public.order_events;
create policy "order_events_insert_seller_line_items"
  on public.order_events for insert
  to authenticated
  with check (exists (
    select 1 from public.order_items oi
    where oi.order_id = order_events.order_id
      and oi.seller_id = auth.uid()
  ));
