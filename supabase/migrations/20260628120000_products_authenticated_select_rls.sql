-- RLS on listings: allow reads for both anon (home feed, guest browse) and authenticated (chat attachment, etc.).
-- Idempotent: safe to run more than once.

alter table public.products enable row level security;

drop policy if exists "Allow authenticated users to read products" on public.products;
drop policy if exists "Allow anon to read products" on public.products;

create policy "Allow authenticated users to read products"
  on public.products
  for select
  to authenticated
  using (true);

-- Home / product grids use the anon Supabase client when logged out; without this, listings disappear after RLS is enabled.
create policy "Allow anon to read products"
  on public.products
  for select
  to anon
  using (true);

notify pgrst, 'reload schema';
