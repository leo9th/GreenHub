-- Issue 2: Notifications type check constraint (run in Supabase SQL Editor if needed).
-- Fails if existing rows use a type not listed below — clean data first.

alter table public.notifications drop constraint if exists notification_type_check;

alter table public.notifications
  add constraint notification_type_check
  check (
    type in (
      'message',
      'product_like',
      'profile_follow',
      'product_sold',
      'boost_expiring',
      'comment',
      'reply'
    )
  );
