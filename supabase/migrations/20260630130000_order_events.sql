-- Timeline / audit rows for buyer-visible order history (e.g. "Order Placed").
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_label text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists order_events_order_id_created_at_idx
  on public.order_events (order_id, created_at asc);

alter table public.order_events enable row level security;

-- Buyers see events on orders they placed.
drop policy if exists "order_events_select_buyer" on public.order_events;
create policy "order_events_select_buyer"
  on public.order_events for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.buyer_id = auth.uid()
  ));

-- Sellers see events for orders that include their line items.
drop policy if exists "order_events_select_seller" on public.order_events;
create policy "order_events_select_seller"
  on public.order_events for select
  to authenticated
  using (exists (
    select 1 from public.order_items oi
    where oi.order_id = order_events.order_id and oi.seller_id = auth.uid()
  ));

-- Only the buyer can append events while placing/managing their own order (checkout writes).
drop policy if exists "order_events_insert_buyer_own_order" on public.order_events;
create policy "order_events_insert_buyer_own_order"
  on public.order_events for insert
  to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and o.buyer_id = auth.uid()
  ));
