-- Vehicle listings: popular car brand for Nigeria marketplace
alter table public.products add column if not exists car_brand text;

comment on column public.products.car_brand is 'When category is vehicles, seller-selected brand (preset name or custom text for "Other").';
