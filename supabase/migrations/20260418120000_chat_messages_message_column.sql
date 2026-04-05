-- chat_messages content column is `message` (not `body`). Idempotent.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'body'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'message'
  ) then
    alter table public.chat_messages rename column body to message;
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
