-- Per-message delivery receipts: sent → delivered → read (recipient updates only).

alter table public.chat_messages
  add column if not exists status text not null default 'sent',
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

alter table public.chat_messages drop constraint if exists chat_messages_status_check;
alter table public.chat_messages
  add constraint chat_messages_status_check
  check (status in ('sent', 'delivered', 'read'));

comment on column public.chat_messages.status is 'Delivery state from sender POV: sent (persisted), delivered (recipient device), read (recipient opened thread).';
comment on column public.chat_messages.delivered_at is 'Set when recipient client receives the message.';
comment on column public.chat_messages.read_at is 'Set when recipient has read the message (chat opened / marked read).';

-- Recipients may update receipt fields only (enforced in trigger).
drop policy if exists "chat_messages_update_recipient_receipts" on public.chat_messages;
create policy "chat_messages_update_recipient_receipts"
  on public.chat_messages
  for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and c.id is not null
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
    and sender_id is distinct from auth.uid()
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
    and sender_id is distinct from auth.uid()
  );

create or replace function public.chat_messages_enforce_receipt_columns_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.sender_id is not distinct from auth.uid() then
    raise exception 'Only the recipient can update delivery receipts'
      using errcode = '42501';
  end if;

  if new.message is distinct from old.message
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
  then
    raise exception 'Recipients may only change status, delivered_at, read_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_messages_receipt_columns_only on public.chat_messages;
create trigger trg_chat_messages_receipt_columns_only
  before update on public.chat_messages
  for each row
  execute function public.chat_messages_enforce_receipt_columns_only();

grant update on table public.chat_messages to authenticated;

-- Batch mark inbound messages delivered (recipient device).
create or replace function public.mark_conversation_messages_delivered(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.chat_messages m
  set
    delivered_at = coalesce(m.delivered_at, now()),
    status =
      case
        when m.read_at is not null then 'read'
        else 'delivered'
      end
  from public.conversations c
  where m.conversation_id = p_conversation_id
    and m.conversation_id = c.id
    and m.sender_id is distinct from auth.uid()
    and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    and m.delivered_at is null;
end;
$$;

-- Batch mark inbound messages read (recipient opened chat).
create or replace function public.mark_conversation_messages_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.chat_messages m
  set
    read_at = now(),
    delivered_at = coalesce(m.delivered_at, now()),
    status = 'read'
  from public.conversations c
  where m.conversation_id = p_conversation_id
    and m.conversation_id = c.id
    and m.sender_id is distinct from auth.uid()
    and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    and m.read_at is null;
end;
$$;

grant execute on function public.mark_conversation_messages_delivered(uuid) to authenticated;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;

-- Realtime: ensure updates stream to clients (idempotent if already member).
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
  end;
end $$;
