-- GreenHub: seller dashboard metrics support + ID verification
-- Run in Supabase SQL Editor or via `supabase db push` if using CLI.

-- 1) Product view counts (seller dashboard "Total views" + product detail)
alter table public.products
  add column if not exists views integer not null default 0;

comment on column public.products.views is 'Incremented when listing detail is opened; used for seller dashboard.';

-- Atomic increment (avoids read-modify-write races; callable by anon/authenticated clients)
create or replace function public.increment_product_views(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set views = coalesce(views, 0) + 1
  where id = p_product_id;
end;
$$;

grant execute on function public.increment_product_views(bigint) to anon, authenticated;

-- Allow sellers to read parent orders when they have a line item (dashboard metrics + recent activity).
-- RLS on orders is often buyer-only; add this so seller queries do not return empty.
drop policy if exists "orders_select_for_seller_line_items" on public.orders;
create policy "orders_select_for_seller_line_items"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id
        and oi.seller_id = auth.uid()
    )
  );

-- Sellers read their own line items (dashboard + fulfillment).
drop policy if exists "order_items_select_seller_own" on public.order_items;
create policy "order_items_select_seller_own"
  on public.order_items for select
  to authenticated
  using (seller_id = auth.uid());

-- Buyers can read line items on orders they placed (keeps checkout/order pages working alongside seller policy).
drop policy if exists "order_items_select_buyer_order" on public.order_items;
create policy "order_items_select_buyer_order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.buyer_id = auth.uid()
    )
  );

-- If your products.id is UUID instead of bigint, use this variant and comment out the bigint version:
-- create or replace function public.increment_product_views(p_product_id uuid) ...

-- 2) Seller ID verification metadata (files live in Storage)
create table if not exists public.seller_verification (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  id_type text not null check (id_type in ('nin', 'drivers_license', 'passport')),
  storage_path text not null,
  file_name text,
  mime_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, id_type)
);

create index if not exists seller_verification_seller_id_idx on public.seller_verification (seller_id);

alter table public.seller_verification enable row level security;

drop policy if exists "seller_verification_select_own" on public.seller_verification;
create policy "seller_verification_select_own"
  on public.seller_verification for select
  using (seller_id = auth.uid());

drop policy if exists "seller_verification_insert_own" on public.seller_verification;
create policy "seller_verification_insert_own"
  on public.seller_verification for insert
  with check (seller_id = auth.uid());

drop policy if exists "seller_verification_update_own" on public.seller_verification;
create policy "seller_verification_update_own"
  on public.seller_verification for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- 3) Private bucket for verification documents
insert into storage.buckets (id, name, public)
values ('seller-verification', 'seller-verification', false)
on conflict (id) do update set public = excluded.public;

-- Storage RLS: sellers read/write only under their user-id prefix (folder = uuid)
drop policy if exists "seller_verification_storage_insert" on storage.objects;
create policy "seller_verification_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_select" on storage.objects;
create policy "seller_verification_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_update" on storage.objects;
create policy "seller_verification_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_delete" on storage.objects;
create policy "seller_verification_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- If storage.foldername is unavailable, replace the predicate with:
-- split_part(name, '/', 1) = auth.uid()::text
