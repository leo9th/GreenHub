-- Allow marketplace pages (product detail, profiles) to read seller reviews and approved verification status.
-- Existing policy keeps insert rules; this adds read access for trust display.

drop policy if exists "seller_reviews_select_marketplace" on public.seller_reviews;
create policy "seller_reviews_select_marketplace"
  on public.seller_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "seller_verification_select_approved_public" on public.seller_verification;
create policy "seller_verification_select_approved_public"
  on public.seller_verification for select
  to anon, authenticated
  using (status = 'approved');
