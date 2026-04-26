create table if not exists public.product_ride_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  seller_user_id uuid null references auth.users (id) on delete set null,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  contact_phone text not null,
  rider_note text null,
  source text not null default 'product_detail',
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'accepted', 'en_route', 'delivered', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_ride_bookings_user_idx on public.product_ride_bookings (user_id, created_at desc);
create index if not exists product_ride_bookings_status_idx on public.product_ride_bookings (status, created_at desc);

create or replace function public.trg_product_ride_bookings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_ride_bookings_set_updated_at on public.product_ride_bookings;
create trigger product_ride_bookings_set_updated_at
before update on public.product_ride_bookings
for each row execute function public.trg_product_ride_bookings_set_updated_at();

alter table public.product_ride_bookings enable row level security;

drop policy if exists product_ride_bookings_select_involved on public.product_ride_bookings;
create policy product_ride_bookings_select_involved
on public.product_ride_bookings
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = seller_user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);

drop policy if exists product_ride_bookings_insert_own on public.product_ride_bookings;
create policy product_ride_bookings_insert_own
on public.product_ride_bookings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists product_ride_bookings_update_own_or_admin on public.product_ride_bookings;
create policy product_ride_bookings_update_own_or_admin
on public.product_ride_bookings
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);
