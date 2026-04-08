-- Create order_items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id),
  seller_id uuid not null references auth.users(id),
  product_title text not null,
  product_image text,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  delivery_fee_at_time numeric(10,2),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Add indexes
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_seller_id_idx on public.order_items(seller_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- Enable RLS
alter table public.order_items enable row level security;

-- RLS policies
create policy "Users can view their own order items"
  on public.order_items for select
  to authenticated
  using (seller_id = auth.uid() or exists (
    select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
  ));

create policy "System can insert order items"
  on public.order_items for insert
  to authenticated
  with check (exists (
    select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
  ));
