-- Chat redesign: media_url + edited on chat_messages, typing_status, user_status, chat-media bucket,
-- sender message edit policy, and updated receipt/edit enforcement trigger.
-- Note: GreenHub uses public.chat_messages (not public.messages).

-- ---------------------------------------------------------------------------
-- chat_messages: voice/other media URL + edited flag
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists media_url text,
  add column if not exists edited boolean not null default false;

comment on column public.chat_messages.media_url is 'Public URL for voice notes or other non-image media.';
comment on column public.chat_messages.edited is 'True after the sender edited message text.';

-- ---------------------------------------------------------------------------
-- Last preview + notifications: voice notes
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(
      coalesce(
        nullif(trim(coalesce(new.message, '')), ''),
        case
          when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
          else null
        end,
        case
          when new.media_url is not null and trim(coalesce(new.media_url, '')) <> '' then 'Voice message'
          else null
        end,
        ''
      ),
      200
    ),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

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
      nullif(trim(coalesce(new.message, '')), ''),
      case
        when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
        else null
      end,
      case
        when new.media_url is not null and trim(coalesce(new.media_url, '')) <> '' then 'Voice message'
        else null
      end,
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

-- ---------------------------------------------------------------------------
-- typing_status (one row per user per conversation)
-- ---------------------------------------------------------------------------
create table if not exists public.typing_status (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint typing_status_conv_user_unique unique (conversation_id, user_id)
);

create index if not exists typing_status_conversation_id_idx on public.typing_status (conversation_id);

alter table public.typing_status enable row level security;

drop policy if exists "typing_status_select_participants" on public.typing_status;
create policy "typing_status_select_participants"
  on public.typing_status for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = typing_status.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_insert_own" on public.typing_status;
create policy "typing_status_insert_own"
  on public.typing_status for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_update_own" on public.typing_status;
create policy "typing_status_update_own"
  on public.typing_status for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = typing_status.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_delete_own" on public.typing_status;
create policy "typing_status_delete_own"
  on public.typing_status for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.typing_status to authenticated;

-- ---------------------------------------------------------------------------
-- user_status (online / last seen)
-- ---------------------------------------------------------------------------
create table if not exists public.user_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_online boolean not null default false,
  last_seen timestamptz not null default now()
);

alter table public.user_status enable row level security;

drop policy if exists "user_status_select_authenticated" on public.user_status;
create policy "user_status_select_authenticated"
  on public.user_status for select
  to authenticated
  using (true);

drop policy if exists "user_status_insert_own" on public.user_status;
create policy "user_status_insert_own"
  on public.user_status for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_status_update_own" on public.user_status;
create policy "user_status_update_own"
  on public.user_status for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.user_status to authenticated;

-- ---------------------------------------------------------------------------
-- chat_messages: recipients vs sender updates (receipts vs edit own text)
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

  -- Sender may only edit text + edited flag (no receipt or attachment changes).
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

  -- Recipients may only update receipt columns.
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

-- ---------------------------------------------------------------------------
-- Storage: chat-media (images + voice)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "Chat media public read" on storage.objects;
create policy "Chat media public read"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "Chat media authenticated upload" on storage.objects;
create policy "Chat media authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-media');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.typing_status;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.user_status;
  exception
    when duplicate_object then null;
  end;
end $$;
