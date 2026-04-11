-- Run in Supabase SQL Editor (idempotent).
-- GreenHub: `public.products.id` is **bigint**, not UUID — do not use UUID for product_id.

alter table public.chat_messages add column if not exists image_url text;
alter table public.chat_messages
  add column if not exists product_id bigint references public.products (id) on delete set null;
alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages (id) on delete set null;
alter table public.chat_messages add column if not exists status text default 'sent';
alter table public.chat_messages add column if not exists delivered_at timestamptz;
alter table public.chat_messages add column if not exists read_at timestamptz;

-- Optional: allow legacy rows without status before backfill
update public.chat_messages set status = 'sent' where status is null;

alter table public.chat_messages drop constraint if exists chat_messages_status_check;
alter table public.chat_messages add constraint chat_messages_status_check
  check (status in ('sending', 'sent', 'delivered', 'read'));

create index if not exists idx_chat_messages_product_id on public.chat_messages (product_id)
  where product_id is not null;
create index if not exists idx_chat_messages_reply_to_id on public.chat_messages (reply_to_id)
  where reply_to_id is not null;
create index if not exists idx_chat_messages_status on public.chat_messages (status);

notify pgrst, 'reload schema';
