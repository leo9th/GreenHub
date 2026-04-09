-- GreenHub product review compatibility setup.
-- Safe to run in Supabase SQL Editor on projects where `products.id` may be bigint or uuid.

alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;

comment on column public.products.average_rating is 'Average star rating (1-5) from product_reviews; null when no reviews.';
comment on column public.products.total_reviews is 'Count of rows in product_reviews for this listing.';

do $$
declare
  product_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  where a.attrelid = 'public.products'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if product_id_type is null then
    raise exception 'public.products.id was not found';
  end if;

  if to_regclass('public.product_reviews') is null then
    execute format(
      'create table public.product_reviews (
         id uuid primary key default gen_random_uuid(),
         product_id %1$s not null references public.products(id) on delete cascade,
         user_id uuid not null references auth.users(id) on delete cascade,
         rating smallint not null check (rating >= 1 and rating <= 5),
         comment text not null default '''',
         created_at timestamptz not null default now(),
         constraint product_reviews_one_per_user unique (product_id, user_id)
       )',
      product_id_type
    );
  else
    execute 'alter table public.product_reviews add column if not exists id uuid default gen_random_uuid()';
    execute 'alter table public.product_reviews add column if not exists user_id uuid references auth.users(id) on delete cascade';
    execute 'alter table public.product_reviews add column if not exists rating smallint';
    execute 'alter table public.product_reviews add column if not exists comment text not null default ''''''';
    execute 'alter table public.product_reviews add column if not exists created_at timestamptz not null default now()';

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'product_reviews'
        and column_name = 'product_id'
    ) then
      execute format(
        'alter table public.product_reviews add column product_id %1$s references public.products(id) on delete cascade',
        product_id_type
      );
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'product_reviews_one_per_user'
        and conrelid = 'public.product_reviews'::regclass
    ) then
      execute 'alter table public.product_reviews add constraint product_reviews_one_per_user unique (product_id, user_id)';
    end if;
  end if;
end $$;

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);
create index if not exists product_reviews_created_at_idx on public.product_reviews (created_at desc);

do $$
declare
  product_id_type text;
  review_product_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  where a.attrelid = 'public.products'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod)
  into review_product_id_type
  from pg_attribute a
  where a.attrelid = 'public.product_reviews'::regclass
    and a.attname = 'product_id'
    and not a.attisdropped;

  if review_product_id_type is distinct from product_id_type then
    raise notice 'Type mismatch detected: product_reviews.product_id is %, products.id is %. Update product_reviews.product_id to match products.id before using reviews.', review_product_id_type, product_id_type;
  end if;
end $$;

do $$
declare
  product_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  where a.attrelid = 'public.products'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  execute format(
    'create or replace function public.refresh_product_review_aggregates(p_product_id %1$s)
     returns void
     language plpgsql
     security definer
     set search_path = public
     as $fn$
     declare
       cnt integer;
       avg_r numeric(4, 2);
     begin
       select
         count(*)::integer,
         case when count(*) = 0 then null else round(avg(rating::numeric), 2) end
       into cnt, avg_r
       from public.product_reviews
       where product_id = p_product_id;

       update public.products
       set
         total_reviews = coalesce(cnt, 0),
         average_rating = avg_r
       where id = p_product_id;
     end;
     $fn$',
    product_id_type
  );
end $$;

create or replace function public.trg_product_reviews_refresh_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_review_aggregates(old.product_id);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform public.refresh_product_review_aggregates(old.product_id);
    end if;
    perform public.refresh_product_review_aggregates(new.product_id);
    return new;
  else
    perform public.refresh_product_review_aggregates(new.product_id);
    return new;
  end if;
end;
$$;

drop trigger if exists product_reviews_refresh_aggregates on public.product_reviews;
create trigger product_reviews_refresh_aggregates
  after insert or update or delete on public.product_reviews
  for each row
  execute function public.trg_product_reviews_refresh_aggregates();

alter table public.product_reviews enable row level security;

drop policy if exists "product_reviews_select_marketplace" on public.product_reviews;
create policy "product_reviews_select_marketplace"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "product_reviews_insert_by_buyer" on public.product_reviews;
create policy "product_reviews_insert_by_buyer"
  on public.product_reviews for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.seller_id is distinct from auth.uid()
    )
  );

drop policy if exists "product_reviews_update_own" on public.product_reviews;
create policy "product_reviews_update_own"
  on public.product_reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "product_reviews_delete_own" on public.product_reviews;
create policy "product_reviews_delete_own"
  on public.product_reviews for delete
  to authenticated
  using (user_id = auth.uid());
