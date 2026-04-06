-- Chat sends failed with "Message not sent" because notify_recipient_on_new_message()
-- (after insert on chat_messages) inserts into notifications with user_id = recipient.
-- RLS policy notifications_insert_own only allows user_id = auth.uid(); the session user
-- is still the sender, so the insert violated policy and rolled back the whole message insert.

drop policy if exists "notifications_insert_peer_message" on public.notifications;

create policy "notifications_insert_peer_message"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'message'
    and exists (
      select 1
      from public.conversations c
      where (c.buyer_id = auth.uid() and c.seller_id = user_id)
         or (c.seller_id = auth.uid() and c.buyer_id = user_id)
    )
  );
