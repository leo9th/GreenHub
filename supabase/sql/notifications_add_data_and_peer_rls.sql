-- -----------------------------------------------------------------------------
-- Option 1 (recommended): align with GreenHub migrations + frontend (engagement.ts
-- selects `data`). Adds missing `data` and the peer-message RLS policy.
-- Safe to run more than once.
-- -----------------------------------------------------------------------------

alter table public.notifications
  add column if not exists data jsonb not null default '{}';

comment on column public.notifications.data is
  'Payload for routing (e.g. message: conversation_id, message_id, sender_id).';

-- RLS: allow the sender session to insert a row for the other party on the thread
-- (required so notify_recipient_on_new_message() succeeds after chat_messages insert).
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

-- Ensure trigger + mark RPC match repo (recreate if you had an older schema).
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

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recip,
    'message',
    'New message',
    body_text,
    jsonb_build_object(
      'conversation_id', new.conversation_id::text,
      'message_id', new.id::text,
      'sender_id', new.sender_id::text
    )
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
    and coalesce(data->>'conversation_id', '') = p_conversation_id::text;
end;
$$;

grant execute on function public.mark_message_notifications_read(uuid) to authenticated;
