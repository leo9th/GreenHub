-- =============================================================================
-- GreenHub: product thread context + emoji reactions (dashboard / manual run)
-- Source: supabase/migrations/20260416100000_conversations_context_product_read_receipts.sql
--         supabase/migrations/20260515120000_chat_message_reactions.sql
-- Safe to run in Supabase SQL Editor when migrations are not applied via CLI.
-- =============================================================================

-- ---------- 20260416100000_conversations_context_product_read_receipts.sql ----------
-- Product context on DM threads + read receipts (peer last-opened time).

alter table public.conversations
  add column if not exists context_product_id bigint references public.products (id) on delete set null;

alter table public.conversations
  add column if not exists buyer_last_read_at timestamptz;

alter table public.conversations
  add column if not exists seller_last_read_at timestamptz;

create index if not exists conversations_context_product_id_idx on public.conversations (context_product_id);

-- ---------- 20260515120000_chat_message_reactions.sql ----------
-- Emoji reactions on chat messages (one reaction per user per message; upsert replaces).

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint chat_message_reactions_message_user_unique unique (message_id, user_id),
  constraint chat_message_reactions_emoji_len check (char_length(emoji) >= 1 and char_length(emoji) <= 32)
);

create index if not exists chat_message_reactions_conversation_id_idx
  on public.chat_message_reactions (conversation_id);

create index if not exists chat_message_reactions_message_id_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_message_reactions_select_participants" on public.chat_message_reactions;
create policy "chat_message_reactions_select_participants"
  on public.chat_message_reactions for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = chat_message_reactions.conversation_id
        and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "chat_message_reactions_insert_participant" on public.chat_message_reactions;
create policy "chat_message_reactions_insert_participant"
  on public.chat_message_reactions for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = chat_message_reactions.conversation_id
        and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "chat_message_reactions_update_own" on public.chat_message_reactions;
create policy "chat_message_reactions_update_own"
  on public.chat_message_reactions for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "chat_message_reactions_delete_own" on public.chat_message_reactions;
create policy "chat_message_reactions_delete_own"
  on public.chat_message_reactions for delete
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.chat_message_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_message_reactions;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
