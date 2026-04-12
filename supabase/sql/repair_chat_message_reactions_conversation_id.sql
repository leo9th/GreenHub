-- Fix: "column conversation_id does not exist" when applying chat_message_reactions.
-- Cause: table was created earlier without conversation_id; CREATE TABLE IF NOT EXISTS
-- does nothing, then CREATE INDEX on (conversation_id) fails.
-- Run in Supabase SQL Editor after any failed migration. Idempotent.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'chat_message_reactions'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'chat_message_reactions'
        and column_name = 'conversation_id'
    ) then
      alter table public.chat_message_reactions
        add column conversation_id uuid;

      -- Fill from parent message (required before NOT NULL + FK)
      update public.chat_message_reactions r
      set conversation_id = m.conversation_id
      from public.chat_messages m
      where m.id = r.message_id
        and r.conversation_id is null;

      -- Drop rows we cannot attach (broken FK to message)
      delete from public.chat_message_reactions where conversation_id is null;

      alter table public.chat_message_reactions
        alter column conversation_id set not null;

      if not exists (
        select 1 from pg_constraint
        where conname = 'chat_message_reactions_conversation_id_fkey'
      ) then
        alter table public.chat_message_reactions
          add constraint chat_message_reactions_conversation_id_fkey
          foreign key (conversation_id)
          references public.conversations (id)
          on delete cascade;
      end if;
    end if;
  end if;
end $$;

create index if not exists chat_message_reactions_conversation_id_idx
  on public.chat_message_reactions (conversation_id);

notify pgrst, 'reload schema';
