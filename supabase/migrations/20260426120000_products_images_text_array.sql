-- Multiple product images: gallery URLs stored as TEXT[]; legacy `image` remains primary/first for compatibility.
alter table public.products add column if not exists images text[] not null default '{}';

comment on column public.products.images is 'Ordered public URLs for product gallery (max 5 in app); first matches image when synced.';

-- Backfill gallery from legacy `image` when the array is still empty.
update public.products
set images = array[trim(image)]::text[]
where image is not null
  and trim(image) <> ''
  and cardinality(images) = 0;
