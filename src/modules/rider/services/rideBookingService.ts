import type { SupabaseClient } from "@supabase/supabase-js";
import { GREENHUB_STANDALONE_BOOKING_PRODUCT_ID } from "../../../app/constants/standaloneBooking";
import type { RideVehicleTier } from "../utils/vehicleTiers";

export type StandaloneRideBookingSource = "home_ride" | "book_ride";

export type CreateStandaloneRideBookingParams = {
  userId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  contactPhone: string;
  vehicleTier: RideVehicleTier;
  estimatedFareNgn: number;
  distanceKm: number;
  note?: string | null;
  source: StandaloneRideBookingSource;
};

/** Whole naira + km rounded to match `numeric(12,4)` / CHECK constraints on insert. */
function normalizeFareAndDistance(estimatedFareNgn: number, distanceKm: number) {
  const estimated_fare_ngn = Math.round(Number(estimatedFareNgn));
  const distance_km = Math.round(Number(distanceKm) * 10_000) / 10_000;
  return { estimated_fare_ngn, distance_km };
}

/**
 * Default sentinel works when `product_id` is `text`.
 * If your DB has `product_id uuid references products(id)`, create a placeholder product row and set:
 * `VITE_GREENHUB_STANDALONE_PRODUCT_ID=<that uuid>`
 */
function standaloneProductId(): string {
  const raw = import.meta.env.VITE_GREENHUB_STANDALONE_PRODUCT_ID as string | undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.length > 0) return t;
  }
  return GREENHUB_STANDALONE_BOOKING_PRODUCT_ID;
}

function describePgError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const o = err as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [o.message, o.details, o.hint, o.code ? `code=${o.code}` : ""].filter(Boolean);
  return parts.join(" — ") || String(err);
}

function looksLikeUuidFailure(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("invalid input syntax for type uuid") || (m.includes("uuid") && m.includes("invalid"));
}

function buildPayload(
  params: CreateStandaloneRideBookingParams,
  riderNote: string,
  opts: { includeFareColumns: boolean; includeBuyerUserId: boolean; productId: string },
  fare: { estimated_fare_ngn: number; distance_km: number },
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: params.userId,
    product_id: opts.productId,
    seller_user_id: null,
    pickup_address: params.pickup.address.trim(),
    pickup_lat: params.pickup.lat,
    pickup_lng: params.pickup.lng,
    dropoff_address: params.dropoff.address.trim(),
    dropoff_lat: params.dropoff.lat,
    dropoff_lng: params.dropoff.lng,
    contact_phone: params.contactPhone.trim(),
    rider_note: riderNote,
    source: params.source,
    status: "pending",
  };
  if (opts.includeBuyerUserId) {
    row.buyer_user_id = params.userId;
  }
  if (opts.includeFareColumns) {
    row.estimated_fare_ngn = fare.estimated_fare_ngn;
    row.distance_km = fare.distance_km;
    row.vehicle_tier = params.vehicleTier;
  }
  return row;
}

/**
 * Inserts a buyer-initiated standalone ride into `product_ride_bookings`.
 * Tries a few compatible row shapes (fare columns / buyer_user_id) so bookings succeed across minor schema differences.
 */
export async function createStandaloneRideBooking(
  client: SupabaseClient,
  params: CreateStandaloneRideBookingParams,
): Promise<{ id: string } | { error: Error }> {
  const fare = normalizeFareAndDistance(params.estimatedFareNgn, params.distanceKm);

  const riderNote = JSON.stringify({
    kind: "ride",
    vehicle_tier: params.vehicleTier,
    estimated_fare_ngn: fare.estimated_fare_ngn,
    distance_km: fare.distance_km,
    note: params.note?.trim() || undefined,
  });

  const productId = standaloneProductId();

  const variants: Array<{ label: string; includeFareColumns: boolean; includeBuyerUserId: boolean }> = [
    { label: "full", includeFareColumns: true, includeBuyerUserId: true },
    { label: "without fare columns", includeFareColumns: false, includeBuyerUserId: true },
    { label: "without buyer_user_id", includeFareColumns: true, includeBuyerUserId: false },
    { label: "without fare columns and buyer_user_id", includeFareColumns: false, includeBuyerUserId: false },
  ];

  let lastMsg = "";

  for (const v of variants) {
    const payload = buildPayload(params, riderNote, {
      includeFareColumns: v.includeFareColumns,
      includeBuyerUserId: v.includeBuyerUserId,
      productId,
    }, fare);

    if (import.meta.env.DEV) {
      console.debug(`[createStandaloneRideBooking] attempt ${v.label}`, Object.keys(payload));
    }

    const { data, error } = await client.from("product_ride_bookings").insert(payload).select("id").maybeSingle();

    lastMsg = error ? describePgError(error) : "";

    if (!error && data?.id) {
      return { id: String(data.id).trim() };
    }

    if (error && looksLikeUuidFailure(lastMsg) && productId === GREENHUB_STANDALONE_BOOKING_PRODUCT_ID) {
      return {
        error: new Error(
          `Ride booking failed: this database expects product_id as a UUID (foreign key to products). ` +
            `Create a placeholder product in Supabase Table Editor, copy its id, and add to your .env: ` +
            `VITE_GREENHUB_STANDALONE_PRODUCT_ID="<paste uuid here>". Original error: ${lastMsg}`,
        ),
      };
    }
  }

  return {
    error: new Error(
      `Could not submit booking: ${lastMsg || "unknown error"}. ` +
        `If product_id references products(id), set VITE_GREENHUB_STANDALONE_PRODUCT_ID. ` +
        `If fare columns are missing in PostgREST, reload the API schema or re-run migrations.`,
    ),
  };
}
