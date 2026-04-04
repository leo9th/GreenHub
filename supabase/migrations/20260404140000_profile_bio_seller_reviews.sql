-- GreenHub: optional bio on profiles + buyer reviews about sellers (classifieds profile)

alter table public.profiles
  add column if not exists bio text;

comment on column public.profiles.bio is 'Optional public-facing about text for profile / listings trust.';

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint seller_reviews_no_self check (seller_id <> reviewer_id)
);

create index if not exists seller_reviews_seller_id_idx on public.seller_reviews (seller_id);
create index if not exists seller_reviews_created_at_idx on public.seller_reviews (created_at desc);

alter table public.seller_reviews enable row level security;

drop policy if exists "seller_reviews_select_parties" on public.seller_reviews;
create policy "seller_reviews_select_parties"
  on public.seller_reviews for select
  to authenticated
  using (seller_id = auth.uid() or reviewer_id = auth.uid());

-- Optional: allow anyone logged in to read reviews for a seller (public profile later). Uncomment if needed:
-- drop policy if exists "seller_reviews_select_public" on public.seller_reviews;
-- create policy "seller_reviews_select_public"
--   on public.seller_reviews for select
--   to authenticated
--   using (true);

drop policy if exists "seller_reviews_insert_by_reviewer" on public.seller_reviews;
create policy "seller_reviews_insert_by_reviewer"
  on public.seller_reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and seller_id <> auth.uid()
  );
