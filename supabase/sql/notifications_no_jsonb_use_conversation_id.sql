-- -----------------------------------------------------------------------------
-- Option 2: No `data` jsonb column — use `conversation_id` on notifications instead.
-- Run this ONLY if you will NOT add `data` (and you add the column below).
-- You must update the frontend to select `conversation_id` instead of (or in
-- addition to) `data` if you drop `data` entirely.
-- -----------------------------------------------------------------------------

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

create index if not exists notifications_user_conversation_idx
  on public.notifications (user_id, conversation_id)
  where conversation_id is not null;

-- Peer RLS (same as Option 1; does not reference `data`).
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

create or replace function public.notify_recipient_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip uuid;
  c record;
  body_text text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.sender_id = c.buyer_id then
    recip := c.seller_id;
  elsif new.sender_id = c.seller_id then
    recip := c.buyer_id;
  else
    return new;
  end if;

  body_text := left(
    coalesce(
      nullif(trim(new.message), ''),
      nullif(trim(new.body), ''),
      'New message'
    ),
    200
  );

  insert into public.notifications (user_id, type, title, body, conversation_id)
  values (
    recip,
    'message',
    'New message',
    body_text,
    new.conversation_id
  );

  return new;
end;
$$;

create or replace function public.mark_message_notifications_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and type = 'message'
    and conversation_id = p_conversation_id;
end;
$$;

grant execute on function public.mark_message_notifications_read(uuid) to authenticated;
