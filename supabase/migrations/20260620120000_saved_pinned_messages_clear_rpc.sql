-- Saved messages (per user), pinned message (one per conversation), and RPC to clear all messages for participants.

create table if not exists public.saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index if not exists saved_messages_user_id_idx on public.saved_messages (user_id);
create index if not exists saved_messages_message_id_idx on public.saved_messages (message_id);

comment on table public.saved_messages is 'User starred/saved chat messages (WhatsApp-style).';

create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  pinned_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id)
);

create index if not exists pinned_messages_conversation_id_idx on public.pinned_messages (conversation_id);

comment on table public.pinned_messages is 'At most one pinned message per conversation.';

-- ---------------------------------------------------------------------------
-- Clear all messages: participants only (bypasses per-row delete RLS).
-- ---------------------------------------------------------------------------
create or replace function public.clear_conversation_messages (p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid () is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
  ) then
    raise exception 'Not a participant';
  end if;
  delete from public.chat_messages
  where conversation_id = p_conversation_id;
end;
$$;

grant execute on function public.clear_conversation_messages (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: saved_messages
-- ---------------------------------------------------------------------------
alter table public.saved_messages enable row level security;

drop policy if exists "saved_messages_select_own" on public.saved_messages;
create policy "saved_messages_select_own"
  on public.saved_messages for select
  to authenticated
  using (user_id = auth.uid ());

drop policy if exists "saved_messages_insert_participant" on public.saved_messages;
create policy "saved_messages_insert_participant"
  on public.saved_messages for insert
  to authenticated
  with check (
    user_id = auth.uid ()
    and exists (
      select 1
      from public.chat_messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = saved_messages.message_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
  );

drop policy if exists "saved_messages_delete_own" on public.saved_messages;
create policy "saved_messages_delete_own"
  on public.saved_messages for delete
  to authenticated
  using (user_id = auth.uid ());

grant select, insert, delete on table public.saved_messages to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: pinned_messages
-- ---------------------------------------------------------------------------
alter table public.pinned_messages enable row level security;

drop policy if exists "pinned_messages_select_participant" on public.pinned_messages;
create policy "pinned_messages_select_participant"
  on public.pinned_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = pinned_messages.conversation_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
  );

drop policy if exists "pinned_messages_write_participant" on public.pinned_messages;
create policy "pinned_messages_write_participant"
  on public.pinned_messages for insert
  to authenticated
  with check (
    pinned_by = auth.uid ()
    and exists (
      select 1
      from public.conversations c
      where c.id = pinned_messages.conversation_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
    and exists (
      select 1
      from public.chat_messages m
      where m.id = pinned_messages.message_id
        and m.conversation_id = pinned_messages.conversation_id
    )
  );

drop policy if exists "pinned_messages_update_participant" on public.pinned_messages;
create policy "pinned_messages_update_participant"
  on public.pinned_messages for update
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = pinned_messages.conversation_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = pinned_messages.conversation_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
    and exists (
      select 1
      from public.chat_messages m
      where m.id = pinned_messages.message_id
        and m.conversation_id = pinned_messages.conversation_id
    )
  );

drop policy if exists "pinned_messages_delete_participant" on public.pinned_messages;
create policy "pinned_messages_delete_participant"
  on public.pinned_messages for delete
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = pinned_messages.conversation_id
        and (c.buyer_id = auth.uid () or c.seller_id = auth.uid ())
    )
  );

grant select, insert, update, delete on table public.pinned_messages to authenticated;

notify pgrst, 'reload schema';
