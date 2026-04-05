-- Align with app: column `last_message` (not `last_message_preview`) + trigger update.

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
    last_message = left(new.body, 200),
    last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
