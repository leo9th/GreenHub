-- Direct messaging: conversations (buyer_id / seller_id) + chat_messages.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_roles check (buyer_id <> seller_id)
);

create unique index if not exists conversations_pair_idx
  on public.conversations (least(buyer_id, seller_id), greatest(buyer_id, seller_id));

create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at desc);

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(new.message, 200),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_chat_message on public.chat_messages;
create trigger trg_touch_conversation_on_chat_message
  after insert on public.chat_messages
  for each row
  execute function public.touch_conversation_on_chat_message();

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
