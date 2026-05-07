-- ============================================================================
-- Seed a placeholder product for standalone ride bookings (product_ride_bookings)
-- ============================================================================
-- GreenHub migrations use public.products.seller_id → auth.users(id).
-- There is no `public.sellers` table in stock migrations — listings tie directly to auth users.
--
-- Run in Supabase Dashboard → SQL Editor.
--
-- Copy the line printed by NOTICE into `.env`:
--   VITE_GREENHUB_STANDALONE_PRODUCT_ID="<paste-id-here>"
--
-- Optional: force which auth user owns the placeholder (must exist in auth.users):
--   SET LOCAL app.seed_seller_uid = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
-- (Supabase SQL Editor may not preserve SET LOCAL across batches — prefer editing v_seller below.)
-- ============================================================================

begin;

do $$
declare
  v_seller uuid;
  v_marker constant text := '%GH_STANDALONE_RIDE_PLACEHOLDER_V1%';
  v_pid text;
begin
  -- Prefer explicit UUID if you paste one here (otherwise first auth user):
  -- v_seller := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid;
  select id into v_seller from auth.users order by created_at asc limit 1;

  if v_seller is null then
    raise exception 'No rows in auth.users. Register one account, then re-run.';
  end if;

  select p.id::text into v_pid
  from public.products p
  where p.description ilike v_marker
  limit 1;

  if v_pid is not null then
    raise notice 'Standalone ride placeholder already exists. id=%', v_pid;
    raise notice 'SET_VITE_GREENHUB_STANDALONE_PRODUCT_ID=%', v_pid;
    return;
  end if;

  insert into public.products (
    seller_id,
    title,
    description,
    price,
    price_local,
    image,
    images,
    category,
    condition,
    location,
    stock_quantity,
    status,
    delivery_options,
    created_at
  ) values (
    v_seller,
    'GreenHub Ride Service (system)',
    'GH_STANDALONE_RIDE_PLACEHOLDER_V1 — Internal placeholder for standalone ride bookings only.',
    0,
    0,
    'https://placehold.co/120x120/png?text=RIDE',
    array['https://placehold.co/120x120/png?text=RIDE']::text[],
    'services',
    'New',
    'Nigeria',
    999999,
    'active',
    array[]::text[],
    now()
  )
  returning id::text into v_pid;

  raise notice 'Created standalone ride placeholder product.';
  raise notice 'SET_VITE_GREENHUB_STANDALONE_PRODUCT_ID=%', v_pid;
end $$;

commit;

notify pgrst, 'reload schema';
