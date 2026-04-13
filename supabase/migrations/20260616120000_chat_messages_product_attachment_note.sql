-- Idempotent: listing attachment per message (see also 20260512120000_chat_messages_product_id.sql).
alter table public.chat_messages
  add column if not exists product_id bigint references public.products (id) on delete set null;

create index if not exists chat_messages_product_id_idx
  on public.chat_messages (product_id)
  where product_id is not null;
