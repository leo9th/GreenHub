-- GreenHub: saved delivery addresses for user profiles.

create table if not exists public.user_addresses (
  address_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  street text not null,
  city text not null,
  state text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_addresses_user_id_idx on public.user_addresses (user_id);
create unique index if not exists user_addresses_one_default_per_user_idx
  on public.user_addresses (user_id)
  where is_default;

create or replace function public.user_addresses_keep_single_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default then
    update public.user_addresses
      set is_default = false,
          updated_at = now()
      where user_id = new.user_id
        and address_id <> coalesce(new.address_id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  return new;
end;
$$;

drop trigger if exists user_addresses_single_default_trg on public.user_addresses;
create trigger user_addresses_single_default_trg
before insert or update of is_default on public.user_addresses
for each row
execute function public.user_addresses_keep_single_default();

alter table public.user_addresses enable row level security;

drop policy if exists "user_addresses_select_own" on public.user_addresses;
create policy "user_addresses_select_own"
  on public.user_addresses for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_addresses_insert_own" on public.user_addresses;
create policy "user_addresses_insert_own"
  on public.user_addresses for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_addresses_update_own" on public.user_addresses;
create policy "user_addresses_update_own"
  on public.user_addresses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_addresses_delete_own" on public.user_addresses;
create policy "user_addresses_delete_own"
  on public.user_addresses for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.user_addresses to authenticated;
