-- Reply threading + delete own messages + conversation preview after deletes.

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages (id) on delete set null;

create index if not exists chat_messages_reply_to_id_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

-- ---------------------------------------------------------------------------
-- After a message is deleted, refresh conversations.last_message / last_message_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_chat_message_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lm text;
  lmt timestamptz;
begin
  select left(m.message, 200), m.created_at into lm, lmt
  from public.chat_messages m
  where m.conversation_id = old.conversation_id
  order by m.created_at desc
  limit 1;

  update public.conversations
  set
    last_message = lm,
    last_message_at = lmt
  where id = old.conversation_id;

  return old;
end;
$$;

drop trigger if exists trg_touch_conversation_on_chat_message_delete on public.chat_messages;
create trigger trg_touch_conversation_on_chat_message_delete
  after delete on public.chat_messages
  for each row execute function public.touch_conversation_on_chat_message_delete();

drop policy if exists "chat_messages_delete_own" on public.chat_messages;

create policy "chat_messages_delete_own"
  on public.chat_messages for delete
  to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

grant delete on table public.chat_messages to authenticated;
