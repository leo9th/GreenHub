import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "@/app/icons/emojiLucide";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { reverseGeocode } from "../../utils/osmGeocode";
import {
  createStandaloneRideBooking,
  estimateRideFareNgn,
  formatNgn,
  haversineKm,
  useDebouncedAddressSuggestions,
  type RideVehicleTier,
  VEHICLE_TIER_OPTIONS,
} from "../../../modules/rider";

const DeliveryTrackingMapPreview = lazy(() => import("../maps/DeliveryTrackingMap"));

export default function RideBookingForm() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [vehicleTier, setVehicleTier] = useState<RideVehicleTier>("economy");
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pickupSearch = useDebouncedAddressSuggestions(pickupQuery);
  const dropoffSearch = useDebouncedAddressSuggestions(dropoffQuery);

  const distanceKm = useMemo(() => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) return null;
    return haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const estimatedFareNgn = useMemo(() => {
    if (distanceKm == null) return null;
    return estimateRideFareNgn(distanceKm, vehicleTier);
  }, [distanceKm, vehicleTier]);

  const useGpsPickup = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("GPS is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickupLat(lat);
        setPickupLng(lng);
        const label = await reverseGeocode(lat, lng);
        const resolved = label?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setPickupQuery(resolved);
        toast.success("Pickup set from GPS.");
      },
      (err) => toast.error(err.message || "Could not read location."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  const submit = useCallback(async () => {
    if (!authUser?.id) {
      toast.error("Please sign in to book.");
      navigate(`/login?next=${encodeURIComponent("/home?service=ride")}`);
      return;
    }
    if (!pickupQuery.trim() || !dropoffQuery.trim()) {
      toast.error("Pickup and drop-off are required.");
      return;
    }
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      toast.error("Pick addresses from suggestions or use GPS for pickup so we have coordinates.");
      return;
    }
    if (!contactPhone.trim()) {
      toast.error("Contact phone is required.");
      return;
    }
    if (distanceKm == null || estimatedFareNgn == null) {
      toast.error("Could not estimate fare — check your route.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createStandaloneRideBooking(supabase, {
        userId: authUser.id,
        pickup: { address: pickupQuery.trim(), lat: pickupLat, lng: pickupLng },
        dropoff: { address: dropoffQuery.trim(), lat: dropoffLat, lng: dropoffLng },
        contactPhone: contactPhone.trim(),
        vehicleTier,
        estimatedFareNgn,
        distanceKm,
        note: note.trim() || null,
        source: "home_ride",
      });
      if ("error" in result) {
        const msg = result.error.message || "";
        if (
          msg.includes("estimated_fare_ngn") ||
          msg.includes("vehicle_tier") ||
          msg.includes("distance_km") ||
          msg.includes("schema cache")
        ) {
          toast.error("Apply pending Supabase migrations for ride columns, then retry.");
        } else {
          toast.error(msg || "Could not submit booking.");
        }
        return;
      }
      toast.success("Looking for a rider…", { description: "We’ll notify you when someone accepts." });
      navigate(`/bookings/${encodeURIComponent(result.id)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit booking.");
    } finally {
      setSubmitting(false);
    }
  }, [
    authUser?.id,
    contactPhone,
    distanceKm,
    dropoffLat,
    dropoffLng,
    dropoffQuery,
    estimatedFareNgn,
    navigate,
    note,
    pickupLat,
    pickupLng,
    pickupQuery,
    vehicleTier,
  ]);

  const mapReady = pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null;

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">Book a Ride</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
            Fares in Nigerian Naira (₦). Pick addresses from suggestions for accurate pricing.
          </p>
        </div>
        <Link
          to="/book"
          className="shrink-0 text-sm font-semibold text-[#16a34a] hover:underline"
        >
          Open map booking
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {VEHICLE_TIER_OPTIONS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => setVehicleTier(tier.id)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
              vehicleTier === tier.id
                ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
                : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
            }`}
          >
            <span className="block">{tier.label}</span>
            <span className="mt-0.5 block text-[11px] font-normal text-gray-500 dark:text-zinc-400">{tier.description}</span>
          </button>
        ))}
      </div>

      {estimatedFareNgn != null ? (
        <p className="mt-3 text-sm text-gray-700 dark:text-zinc-200">
          Estimated fare ({VEHICLE_TIER_OPTIONS.find((t) => t.id === vehicleTier)?.label ?? vehicleTier}):{" "}
          <span className="font-bold text-emerald-700">{formatNgn(estimatedFareNgn)}</span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">Select pickup and destination to see an estimate.</p>
      )}

      {mapReady ? (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-600">
          <Suspense
            fallback={<div className="h-[220px] w-full animate-pulse bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900" />}
          >
            <DeliveryTrackingMapPreview
              pickupLocation={{ lat: pickupLat, lng: pickupLng }}
              dropoffLocation={{ lat: dropoffLat, lng: dropoffLng }}
              className="h-[220px] w-full"
              enableDemoRiderMovement={false}
            />
          </Suspense>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-foreground">Pickup</label>
          <div className="flex gap-2">
            <input
              value={pickupQuery}
              onChange={(e) => setPickupQuery(e.target.value)}
              placeholder="Search area"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={useGpsPickup}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-foreground dark:hover:bg-zinc-800"
            >
              GPS
            </button>
          </div>
          {pickupSearch.searching ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : null}
          {pickupSearch.suggestions.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {pickupSearch.suggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}-${s.display_name}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white dark:hover:bg-zinc-700"
                    onClick={() => {
                      setPickupQuery(s.display_name);
                      setPickupLat(s.lat);
                      setPickupLng(s.lng);
                    }}
                  >
                    {s.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-foreground">Drop-off</label>
          <input
            value={dropoffQuery}
            onChange={(e) => setDropoffQuery(e.target.value)}
            placeholder="Search destination"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
            autoComplete="off"
          />
          {dropoffSearch.searching ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : null}
          {dropoffSearch.suggestions.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {dropoffSearch.suggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}-${s.display_name}-d`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white dark:hover:bg-zinc-700"
                    onClick={() => {
                      setDropoffQuery(s.display_name);
                      setDropoffLat(s.lat);
                      setDropoffLng(s.lng);
                    }}
                  >
                    {s.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-foreground">Phone</label>
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+234…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-foreground">Notes (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Landmark, gate code…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16a34a] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Submitting…" : "Request ride"}
      </button>
    </section>
  );
}
