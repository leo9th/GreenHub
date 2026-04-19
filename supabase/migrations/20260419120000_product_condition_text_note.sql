-- products.condition stores free-text labels (no enum). New values "Foreign Used" and "Used"
-- require no schema change. Optional manual default:
--   ALTER TABLE public.products ALTER COLUMN condition SET DEFAULT 'New';

comment on column public.products.condition is 'Listing condition label: New, Like New, Good, Fair, Used, Foreign Used, etc.';
