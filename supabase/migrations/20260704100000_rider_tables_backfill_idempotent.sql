-- Backfill/compat migration for rider_presence and product_ride_bookings.
-- Idempotent and safe across environments that may already have older rider schema.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Admin helper
-- -----------------------------------------------------------------------------
create or replace function public.fn_is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  );
$$;

revoke all on function public.fn_is_admin_user() from public;
grant execute on function public.fn_is_admin_user() to authenticated;

-- -----------------------------------------------------------------------------
-- 1) rider_presence
-- Required shape:
-- id, rider_id (unique -> riders.id), is_online, latitude, longitude,
-- last_seen_at, created_at
-- -----------------------------------------------------------------------------
create table if not exists public.rider_presence (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid unique references public.riders(id) on delete cascade,
  is_online boolean not null default false,
  latitude double precision null,
  longitude double precision null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.rider_presence
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists rider_id uuid null,
  add column if not exists is_online boolean not null default false,
  add column if not exists latitude double precision null,
  add column if not exists longitude double precision null,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rider_presence_pkey'
      and conrelid = 'public.rider_presence'::regclass
  ) then
    alter table public.rider_presence
      add constraint rider_presence_pkey primary key (id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rider_presence_rider_id_fkey'
      and conrelid = 'public.rider_presence'::regclass
  ) then
    alter table public.rider_presence
      add constraint rider_presence_rider_id_fkey
      foreign key (rider_id) references public.riders(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rider_presence_rider_id_key'
      and conrelid = 'public.rider_presence'::regclass
  ) then
    alter table public.rider_presence
      add constraint rider_presence_rider_id_key unique (rider_id);
  end if;
end
$$;

create index if not exists idx_rider_presence_rider_id
  on public.rider_presence (rider_id);

create index if not exists idx_rider_presence_is_online
  on public.rider_presence (is_online);

alter table public.rider_presence enable row level security;

drop policy if exists rider_presence_select_own_or_admin on public.rider_presence;
create policy rider_presence_select_own_or_admin
on public.rider_presence
for select
to authenticated
using (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists rider_presence_insert_own on public.rider_presence;
create policy rider_presence_insert_own
on public.rider_presence
for insert
to authenticated
with check (
  exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists rider_presence_update_own_or_admin on public.rider_presence;
create policy rider_presence_update_own_or_admin
on public.rider_presence
for update
to authenticated
using (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
)
with check (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

grant select, insert, update on public.rider_presence to authenticated;

-- -----------------------------------------------------------------------------
-- 2) product_ride_bookings
-- Required shape:
-- id, product_id (uuid -> products.id), rider_id (nullable -> riders.id),
-- status, pickup_address, delivery_address, created_at, updated_at
-- -----------------------------------------------------------------------------
create table if not exists public.product_ride_bookings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  rider_id uuid null references public.riders(id) on delete set null,
  status text not null default 'pending',
  pickup_address text not null,
  delivery_address text not null,
  buyer_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_ride_bookings
  add column if not exists rider_id uuid null,
  add column if not exists status text not null default 'pending',
  add column if not exists pickup_address text,
  add column if not exists delivery_address text,
  add column if not exists buyer_user_id uuid null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill delivery_address when older schema only has dropoff_address.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_ride_bookings'
      and column_name = 'dropoff_address'
  ) then
    execute $sql$
      update public.product_ride_bookings
      set delivery_address = coalesce(delivery_address, dropoff_address)
      where delivery_address is null
    $sql$;
  end if;
end
$$;

-- Backfill buyer_user_id from existing user_id when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_ride_bookings'
      and column_name = 'user_id'
  ) then
    execute $sql$
      update public.product_ride_bookings
      set buyer_user_id = coalesce(buyer_user_id, user_id)
      where buyer_user_id is null
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_ride_bookings_rider_id_fkey'
      and conrelid = 'public.product_ride_bookings'::regclass
  ) then
    alter table public.product_ride_bookings
      add constraint product_ride_bookings_rider_id_fkey
      foreign key (rider_id) references public.riders(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_ride_bookings_buyer_user_id_fkey'
      and conrelid = 'public.product_ride_bookings'::regclass
  ) then
    alter table public.product_ride_bookings
      add constraint product_ride_bookings_buyer_user_id_fkey
      foreign key (buyer_user_id) references auth.users(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_product_ride_bookings_product_id
  on public.product_ride_bookings (product_id);

create index if not exists idx_product_ride_bookings_rider_id
  on public.product_ride_bookings (rider_id);

create index if not exists idx_product_ride_bookings_status
  on public.product_ride_bookings (status);

create or replace function public.trg_product_ride_bookings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_ride_bookings_touch_updated_at on public.product_ride_bookings;
create trigger product_ride_bookings_touch_updated_at
before update on public.product_ride_bookings
for each row execute function public.trg_product_ride_bookings_touch_updated_at();

alter table public.product_ride_bookings enable row level security;

-- Admins can read/update all bookings.
drop policy if exists product_ride_bookings_select_admin_or_related on public.product_ride_bookings;
create policy product_ride_bookings_select_admin_or_related
on public.product_ride_bookings
for select
to authenticated
using (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = product_ride_bookings.rider_id
      and r.user_id = auth.uid()
  )
  or buyer_user_id = auth.uid()
  or exists (
    select 1
    from public.products p
    where p.id = product_ride_bookings.product_id
      and p.seller_id = auth.uid()
  )
);

drop policy if exists product_ride_bookings_update_admin_or_rider on public.product_ride_bookings;
create policy product_ride_bookings_update_admin_or_rider
on public.product_ride_bookings
for update
to authenticated
using (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = product_ride_bookings.rider_id
      and r.user_id = auth.uid()
  )
)
with check (
  public.fn_is_admin_user()
  or exists (
    select 1
    from public.riders r
    where r.id = product_ride_bookings.rider_id
      and r.user_id = auth.uid()
  )
);

-- Buyers can read bookings for their orders/bookings.
drop policy if exists product_ride_bookings_select_buyer on public.product_ride_bookings;
create policy product_ride_bookings_select_buyer
on public.product_ride_bookings
for select
to authenticated
using (buyer_user_id = auth.uid());

grant select, update on public.product_ride_bookings to authenticated;
