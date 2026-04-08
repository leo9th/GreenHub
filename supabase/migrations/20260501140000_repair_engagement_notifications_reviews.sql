-- Repair engagement notification insert policies.
-- Safe to run more than once.
--
-- Note: the earlier `product_sold` policy is intentionally not recreated here
-- because this database currently does not have `public.order_items`.

drop policy if exists "notifications_insert_product_like" on public.notifications;
create policy "notifications_insert_product_like"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'product_like'
    and data->>'actor_user_id' = auth.uid()::text
    and exists (
      select 1
      from public.products p
      where p.id::text = data->>'product_id'
        and p.seller_id = notifications.user_id
        and p.seller_id <> auth.uid()
    )
  );

drop policy if exists "notifications_insert_profile_follow" on public.notifications;
create policy "notifications_insert_profile_follow"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'profile_follow'
    and data->>'follower_id' = auth.uid()::text
    and data->>'following_id' = notifications.user_id::text
    and exists (
      select 1
      from public.profile_follows f
      where f.follower_id = auth.uid()
        and f.following_id = notifications.user_id
    )
  );

drop policy if exists "notifications_insert_boost_expiring" on public.notifications;
create policy "notifications_insert_boost_expiring"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'boost_expiring'
    and exists (
      select 1
      from public.products p
      where p.id::text = data->>'product_id'
        and p.seller_id = notifications.user_id
        and p.seller_id = auth.uid()
    )
  );
