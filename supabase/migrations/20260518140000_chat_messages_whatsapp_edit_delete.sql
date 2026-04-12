-- WhatsApp-style: edit metadata, delete for me / everyone, soft-delete visibility.
-- Requires prior migrations: chat_messages with edited, media_url, delivery columns.

alter table public.chat_messages
  add column if not exists edited_at timestamptz;

alter table public.chat_messages
  add column if not exists deleted_for_everyone boolean not null default false;

alter table public.chat_messages
  add column if not exists deleted_for uuid[] not null default '{}';

create index if not exists chat_messages_reply_to_id_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

comment on column public.chat_messages.edited_at is 'Set when the sender edits message text.';
comment on column public.chat_messages.deleted_for_everyone is 'When true, content is hidden for all participants (placeholder UI).';
comment on column public.chat_messages.deleted_for is 'Users who chose Delete for me (row still visible as stub for others).';

-- Replace trigger: sender edits text + delete everyone; recipient receipts + append deleted_for.
create or replace function public.chat_messages_enforce_receipt_columns_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;

  -- Sender updates
  if old.sender_id is not distinct from uid then
    -- Delete for everyone: allow clearing attachments + message
    if coalesce(new.deleted_for_everyone, false) = true
       and coalesce(old.deleted_for_everyone, false) = false
    then
      if new.conversation_id is distinct from old.conversation_id
         or new.sender_id is distinct from old.sender_id
         or new.created_at is distinct from old.created_at
         or new.reply_to_id is distinct from old.reply_to_id
         or new.status is distinct from old.status
         or new.delivered_at is distinct from old.delivered_at
         or new.read_at is distinct from old.read_at
         or new.deleted_for is distinct from old.deleted_for
      then
        raise exception 'Invalid delete-for-everyone update'
          using errcode = '42501';
      end if;
      return new;
    end if;

    -- Normal sender edit: message, edited, edited_at only (+ no receipt/attachment changes)
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
       or new.deleted_for_everyone is distinct from old.deleted_for_everyone
       or new.deleted_for is distinct from old.deleted_for
    then
      raise exception 'You may only edit your message text'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Recipients: receipts + append own uid to deleted_for
  if new.message is distinct from old.message
     or new.edited is distinct from old.edited
     or new.edited_at is distinct from old.edited_at
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.image_url is distinct from old.image_url
     or new.media_url is distinct from old.media_url
     or new.product_id is distinct from old.product_id
     or new.deleted_for_everyone is distinct from old.deleted_for_everyone
  then
    raise exception 'Recipients may only change receipts or deleted_for'
      using errcode = '42501';
  end if;

  if new.deleted_for is distinct from old.deleted_for then
    if coalesce(array_length(new.deleted_for, 1), 0) <> coalesce(array_length(old.deleted_for, 1), 0) + 1 then
      raise exception 'deleted_for may only append one id'
        using errcode = '42501';
    end if;
    if not uid = any(new.deleted_for) or uid = any(coalesce(old.deleted_for, '{}')) then
      raise exception 'deleted_for may only append your user id once'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
