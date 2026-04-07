-- Fixes: column f.average_rating does not exist (rpc_products_listing) when an older DB
-- had boost_system applied without products.average_rating / total_reviews.
alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;
