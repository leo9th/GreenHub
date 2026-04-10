-- Optional listing attachment per message (portrait card in UI). GreenHub `products.id` is bigint.

alter table public.chat_messages
  add column if not exists product_id bigint references public.products (id) on delete set null;

create index if not exists chat_messages_product_id_idx
  on public.chat_messages (product_id)
  where product_id is not null;

-- Recipients may still only change receipt columns; forbid mutating attachment fields on update.
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

  if old.sender_id is not distinct from auth.uid() then
    raise exception 'Only the recipient can update delivery receipts'
      using errcode = '42501';
  end if;

  if new.message is distinct from old.message
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.image_url is distinct from old.image_url
     or new.product_id is distinct from old.product_id
  then
    raise exception 'Recipients may only change status, delivered_at, read_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
