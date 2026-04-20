-- Align `chat_messages.product_id` with `public.products.id` when ids are uuid (matches app: `chatMessages.ts` / `ProductPk`).
-- Older migrations used bigint. This file only changes chat when `products.id` is uuid (skips local bigint-only DBs).

-- ---------------------------------------------------------------------------
-- 1) `product_id` still bigint → switch to uuid (clear values; cannot losslessly cast bigint → uuid)
-- ---------------------------------------------------------------------------
do $$
declare
  dt text;
  products_id_type text;
begin
  select c.data_type into products_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  if products_id_type is distinct from 'uuid' then
    raise notice 'skip chat_messages.product_id uuid migration: public.products.id is % (expected uuid)', products_id_type;
    return;
  end if;

  select c.data_type into dt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'chat_messages'
    and c.column_name = 'product_id';

  if dt = 'bigint' then
    alter table public.chat_messages
      drop constraint if exists chat_messages_product_id_fkey;

    drop index if exists chat_messages_product_id_idx;

    alter table public.chat_messages
      alter column product_id drop default;

    alter table public.chat_messages
      alter column product_id type uuid using (null::uuid);

    alter table public.chat_messages
      add constraint chat_messages_product_id_fkey
      foreign key (product_id) references public.products (id) on delete set null;

    create index if not exists chat_messages_product_id_idx
      on public.chat_messages (product_id)
      where product_id is not null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) Column missing → add as uuid (only when products.id is uuid)
-- ---------------------------------------------------------------------------
do $$
declare
  products_id_type text;
begin
  select c.data_type into products_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  if products_id_type is distinct from 'uuid' then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'chat_messages'
      and c.column_name = 'product_id'
  ) then
    alter table public.chat_messages
      add column product_id uuid references public.products (id) on delete set null;

    create index if not exists chat_messages_product_id_idx
      on public.chat_messages (product_id)
      where product_id is not null;
  end if;
end
$$;

notify pgrst, 'reload schema';
