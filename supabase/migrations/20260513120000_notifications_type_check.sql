-- Issue 2: Allowed values for notifications.type (RLS policies reference these).

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
