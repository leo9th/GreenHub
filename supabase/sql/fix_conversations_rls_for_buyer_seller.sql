-- Run in Supabase SQL Editor if Policies still reference participant_a/b (or inbox returns 401/empty).
-- Aligns RLS with columns: buyer_id, seller_id.

alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_participant" on public.conversations;
drop policy if exists "conversations_update_participant" on public.conversations;
drop policy if exists "conversations_select_buyer_or_seller" on public.conversations;
drop policy if exists "conversations_insert_buyer_or_seller" on public.conversations;
drop policy if exists "conversations_update_buyer_or_seller" on public.conversations;

create policy "conversations_select_buyer_or_seller"
  on public.conversations for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_insert_buyer_or_seller"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_update_buyer_or_seller"
  on public.conversations for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "chat_messages_select_participant" on public.chat_messages;
drop policy if exists "chat_messages_insert_sender" on public.chat_messages;
drop policy if exists "chat_messages_select_buyer_seller" on public.chat_messages;
drop policy if exists "chat_messages_insert_sender_buyer_seller" on public.chat_messages;

create policy "chat_messages_select_buyer_seller"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

create policy "chat_messages_insert_sender_buyer_seller"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert on table public.chat_messages to authenticated;
