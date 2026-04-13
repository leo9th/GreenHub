-- One-shot deploy: drop old table if wrong schema, then recreate.
-- Paste entire file into Supabase Dashboard → SQL Editor → Run.
-- (Same as: drop + supabase/sql/product_offers.sql)

drop table if exists public.product_offers cascade;

create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  offer_price numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'countered')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_offers_product_id_idx on public.product_offers (product_id);
create index if not exists product_offers_buyer_id_idx on public.product_offers (buyer_id);
create index if not exists product_offers_status_idx on public.product_offers (status);

create unique index if not exists product_offers_one_pending_per_buyer
  on public.product_offers (product_id, buyer_id)
  where status = 'pending';

comment on table public.product_offers is 'Buyer price offers; sellers respond via status on their listings.';

alter table public.product_offers enable row level security;

grant select, insert, update, delete on table public.product_offers to authenticated;

drop policy if exists "product_offers_insert_buyer" on public.product_offers;
drop policy if exists "product_offers_select_buyer" on public.product_offers;
drop policy if exists "product_offers_select_seller" on public.product_offers;
drop policy if exists "product_offers_update" on public.product_offers;
drop policy if exists "product_offers_delete_buyer_pending" on public.product_offers;

create policy "product_offers_insert_buyer"
  on public.product_offers
  for insert
  to authenticated
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.seller_id is not null
        and p.seller_id <> auth.uid()
    )
  );

create policy "product_offers_select_buyer"
  on public.product_offers
  for select
  to authenticated
  using (auth.uid() = buyer_id);

create policy "product_offers_select_seller"
  on public.product_offers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.seller_id = auth.uid()
    )
  );

create policy "product_offers_update"
  on public.product_offers
  for update
  to authenticated
  using (
    (auth.uid() = buyer_id and status = 'pending')
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.seller_id = auth.uid()
    )
  )
  with check (
    (
      auth.uid() = buyer_id
      and exists (
        select 1
        from public.product_offers o
        where o.id = product_offers.id
          and o.buyer_id = product_offers.buyer_id
          and o.status = 'pending'
      )
    )
    or (
      exists (
        select 1
        from public.products p
        where p.id = product_id
          and p.seller_id = auth.uid()
      )
      and buyer_id = (select o.buyer_id from public.product_offers o where o.id = product_offers.id)
    )
  );

create policy "product_offers_delete_buyer_pending"
  on public.product_offers
  for delete
  to authenticated
  using (auth.uid() = buyer_id and status = 'pending');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.product_offers;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

create or replace function public.product_offers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_offers_set_updated_at on public.product_offers;
create trigger product_offers_set_updated_at
  before update on public.product_offers
  for each row
  execute function public.product_offers_set_updated_at();

notify pgrst, 'reload schema';
