-- Run once in Supabase SQL Editor if your table still has `last_message_preview`.
-- Safe to re-run: no-op if `last_message` already exists.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'last_message_preview'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'last_message'
  ) then
    alter table public.conversations rename column last_message_preview to last_message;
  end if;
end $$;

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
