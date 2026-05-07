-- Ensure dispatch / rider-assignment columns exist on product_ride_bookings.
--
-- Root cause: some environments never applied 20260425170000_product_ride_bookings_dispatch_assignment.sql
-- (skipped migration, partial reset, or older remote DB). PostgREST then errors with
-- "column product_ride_bookings.assigned_rider_id does not exist" when the app selects that field
-- (e.g. StandaloneBookingStatus, Dispatch, RiderDashboard).
--
-- This migration is fully idempotent: safe if the columns already exist.

alter table public.product_ride_bookings
  add column if not exists assigned_rider_id uuid null references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz null,
  add column if not exists accepted_at timestamptz null,
  add column if not exists en_route_at timestamptz null,
  add column if not exists delivered_at timestamptz null;

create index if not exists product_ride_bookings_assigned_rider_idx
  on public.product_ride_bookings (assigned_rider_id, created_at desc);
