-- Reliable message delete via RPC (works when PostgREST/RLS on direct DELETE is flaky).
-- Also normalize trigger syntax for Postgres (EXECUTE PROCEDURE).

-- ---------------------------------------------------------------------------
-- RPC: delete one message (must be sender + participant on conversation)
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_conv uuid;
begin
  select sender_id, conversation_id into v_sender, v_conv
  from public.chat_messages
  where id = p_message_id;

  if v_sender is null then
    raise exception 'Message not found';
  end if;

  if v_sender <> (select auth.uid()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = v_conv
      and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
  ) then
    raise exception 'Not a participant';
  end if;

  delete from public.chat_messages where id = p_message_id;
end;
$$;

revoke all on function public.delete_own_chat_message(uuid) from public;
grant execute on function public.delete_own_chat_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete all messages you sent in a conversation
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_messages_in_conversation(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
  ) then
    raise exception 'Not a participant';
  end if;

  delete from public.chat_messages
  where conversation_id = p_conversation_id
    and sender_id = (select auth.uid());

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.delete_my_messages_in_conversation(uuid) from public;
grant execute on function public.delete_my_messages_in_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ensure delete policy + grant (idempotent)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Trigger: refresh conversation preview (compatible syntax)
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
  for each row
  execute procedure public.touch_conversation_on_chat_message_delete();
