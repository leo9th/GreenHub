-- Standalone ride bookings: quoted fare, route distance, and vehicle tier for dispatch/analytics.
-- All new columns are NULLable so existing rows remain valid without backfills.

alter table public.product_ride_bookings
  add column if not exists estimated_fare_ngn integer null,
  add column if not exists distance_km numeric(12, 4) null,
  add column if not exists vehicle_tier text null;

comment on column public.product_ride_bookings.estimated_fare_ngn is 'Quoted fare in whole Nigerian Naira (₦).';
comment on column public.product_ride_bookings.distance_km is 'Haversine route distance in km at booking time.';
comment on column public.product_ride_bookings.vehicle_tier is 'Passenger tier: bike | economy | comfort | xl | premium.';

-- Optional tier validation (NULL allowed for legacy rows and inserts that omit tier).
alter table public.product_ride_bookings
  drop constraint if exists product_ride_bookings_vehicle_tier_check;

alter table public.product_ride_bookings
  add constraint product_ride_bookings_vehicle_tier_check
  check (
    vehicle_tier is null
    or vehicle_tier in ('bike', 'economy', 'comfort', 'xl', 'premium')
  );
