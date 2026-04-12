-- Append current user to deleted_for on all messages in a conversation (clear chat for me).
create or replace function public.clear_conversation_for_me (p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = uid or c.seller_id = uid)
  ) then
    raise exception 'Not a participant';
  end if;

  update public.chat_messages m
  set deleted_for = array_append(coalesce(m.deleted_for, '{}'), uid)
  where m.conversation_id = p_conversation_id
    and not (uid = any (coalesce(m.deleted_for, '{}')));
end;
$$;

grant execute on function public.clear_conversation_for_me (uuid) to authenticated;
