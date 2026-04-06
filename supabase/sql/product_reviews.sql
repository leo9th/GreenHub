-- GreenHub: product reviews (per listing) + denormalized aggregates on products
-- Same as migrations/20260421120000_product_reviews.sql — run in Supabase SQL Editor.

alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;

comment on column public.products.average_rating is 'Average star rating (1–5) from product_reviews; null when no reviews.';
comment on column public.products.total_reviews is 'Count of rows in product_reviews for this listing.';

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint product_reviews_one_per_user unique (product_id, user_id)
);

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);
create index if not exists product_reviews_created_at_idx on public.product_reviews (created_at desc);

comment on table public.product_reviews is 'Buyer reviews of a specific product listing (distinct from seller_reviews).';

create or replace function public.refresh_product_review_aggregates(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
  avg_r numeric(4, 2);
begin
  select
    count(*)::integer,
    case
      when count(*) = 0 then null
      else round(avg(rating::numeric), 2)
    end
  into cnt, avg_r
  from public.product_reviews
  where product_id = p_product_id;

  update public.products
  set
    total_reviews = coalesce(cnt, 0),
    average_rating = avg_r
  where id = p_product_id;
end;
$$;

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

update public.products p
set
  total_reviews = coalesce(s.cnt, 0),
  average_rating = s.avg_r
from (
  select
    product_id,
    count(*)::int as cnt,
    case when count(*) = 0 then null else round(avg(rating::numeric), 2) end as avg_r
  from public.product_reviews
  group by product_id
) s
where p.id = s.product_id;
