-- ============================================================================
-- GreenHub: repair chat_messages for API / PostgREST (400 on insert/select)
-- Run once in Supabase SQL Editor after diagnostics.
-- Idempotent: safe to re-run.
--
-- Fixes: missing columns, reply_to FK name, status check, RLS policies,
--        receipt/edit trigger (latest), grants, PostgREST schema reload.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns (match app + migrations)
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists reply_to_id uuid;

alter table public.chat_messages
  add column if not exists image_url text;

alter table public.chat_messages
  add column if not exists media_url text;

alter table public.chat_messages
  add column if not exists edited boolean not null default false;

alter table public.chat_messages
  add column if not exists status text not null default 'sent';

alter table public.chat_messages
  add column if not exists delivered_at timestamptz;

alter table public.chat_messages
  add column if not exists read_at timestamptz;

-- product listing attachment (bigint = GreenHub products.id)
alter table public.chat_messages
  add column if not exists product_id bigint references public.products (id) on delete set null;

-- message may be empty when only attachment / product card
alter table public.chat_messages alter column message drop not null;

alter table public.chat_messages drop constraint if exists chat_messages_status_check;
alter table public.chat_messages
  add constraint chat_messages_status_check
  check (status in ('sent', 'delivered', 'read'));

-- ---------------------------------------------------------------------------
-- FK: name must be chat_messages_reply_to_id_fkey for PostgREST embed hints
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'chat_messages'
      and c.conname = 'chat_messages_reply_to_id_fkey'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_reply_to_id_fkey
      foreign key (reply_to_id)
      references public.chat_messages (id)
      on delete set null;
  end if;
end $$;

create index if not exists chat_messages_reply_to_id_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

create index if not exists chat_messages_product_id_idx
  on public.chat_messages (product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE trigger: recipients vs sender (edit own text)
-- ---------------------------------------------------------------------------
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
    if new.conversation_id is distinct from old.conversation_id
       or new.sender_id is distinct from old.sender_id
       or new.created_at is distinct from old.created_at
       or new.reply_to_id is distinct from old.reply_to_id
       or new.image_url is distinct from old.image_url
       or new.media_url is distinct from old.media_url
       or new.product_id is distinct from old.product_id
       or new.status is distinct from old.status
       or new.delivered_at is distinct from old.delivered_at
       or new.read_at is distinct from old.read_at
    then
      raise exception 'You may only edit your message text'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.message is distinct from old.message
     or new.edited is distinct from old.edited
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.image_url is distinct from old.image_url
     or new.media_url is distinct from old.media_url
     or new.product_id is distinct from old.product_id
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

-- ---------------------------------------------------------------------------
-- RLS policies (expected names — drop/recreate so a half-broken DB recovers)
-- ---------------------------------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_buyer_seller" on public.chat_messages;
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

drop policy if exists "chat_messages_insert_sender_buyer_seller" on public.chat_messages;
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

drop policy if exists "chat_messages_update_recipient_receipts" on public.chat_messages;
create policy "chat_messages_update_recipient_receipts"
  on public.chat_messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
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

drop policy if exists "chat_messages_update_own_sender" on public.chat_messages;
create policy "chat_messages_update_own_sender"
  on public.chat_messages for update
  to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

grant select, insert, update, delete on table public.chat_messages to authenticated;

-- ---------------------------------------------------------------------------
-- PostgREST: reload schema cache (fixes "column not found" after ALTER)
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
