-- Run in Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- Fixes missing columns / FK for chat sends + reply embeds; reloads PostgREST schema cache.
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- reply_to_id + FK (must match name chat_messages_reply_to_id_fkey for API embeds)
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists reply_to_id uuid;

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

-- ---------------------------------------------------------------------------
-- media_url, edited (app inserts/selects these)
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists media_url text,
  add column if not exists edited boolean not null default false;

-- ---------------------------------------------------------------------------
-- PostgREST: pick up new columns / FK without waiting
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
