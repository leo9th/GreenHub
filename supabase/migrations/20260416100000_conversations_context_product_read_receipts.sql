-- Product context on DM threads + read receipts (peer last-opened time).

alter table public.conversations
  add column if not exists context_product_id bigint references public.products (id) on delete set null;

alter table public.conversations
  add column if not exists buyer_last_read_at timestamptz;

alter table public.conversations
  add column if not exists seller_last_read_at timestamptz;

create index if not exists conversations_context_product_id_idx on public.conversations (context_product_id);
