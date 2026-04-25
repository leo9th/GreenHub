create table if not exists public.requested_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  requested_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists requested_items_created_at_idx
  on public.requested_items (created_at desc);

create index if not exists requested_items_item_name_idx
  on public.requested_items (lower(item_name));

alter table public.requested_items enable row level security;

drop policy if exists requested_items_select_authenticated on public.requested_items;
create policy requested_items_select_authenticated
  on public.requested_items
  for select
  to authenticated
  using (true);

drop policy if exists requested_items_insert_public on public.requested_items;
create policy requested_items_insert_public
  on public.requested_items
  for insert
  to anon, authenticated
  with check (
    requested_by is null
    or requested_by = auth.uid()
  );

grant select on public.requested_items to authenticated;
grant insert on public.requested_items to anon, authenticated;
