import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "@/app/icons/emojiLucide";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { reverseGeocode, searchAddressSuggestions, type AddressSuggestion } from "../../utils/osmGeocode";
import { GREENHUB_STANDALONE_BOOKING_PRODUCT_ID } from "../../constants/standaloneBooking";

type RideVehicle = "bike" | "car";

export default function RideBookingForm() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [vehicle, setVehicle] = useState<RideVehicle | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = pickupQuery.trim();
    if (q.length < 3) {
      setPickupSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchingPickup(true);
      void searchAddressSuggestions(q)
        .then(setPickupSuggestions)
        .finally(() => setSearchingPickup(false));
    }, 320);
    return () => window.clearTimeout(t);
  }, [pickupQuery]);

  useEffect(() => {
    const q = dropoffQuery.trim();
    if (q.length < 3) {
      setDropoffSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchingDropoff(true);
      void searchAddressSuggestions(q)
        .then(setDropoffSuggestions)
        .finally(() => setSearchingDropoff(false));
    }, 320);
    return () => window.clearTimeout(t);
  }, [dropoffQuery]);

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
    if (!vehicle) {
      toast.error("Choose bike or car.");
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

    setSubmitting(true);
    try {
      const riderNote = JSON.stringify({ kind: "ride", vehicle, note: note.trim() || undefined });
      const payload: Record<string, unknown> = {
        user_id: authUser.id,
        buyer_user_id: authUser.id,
        product_id: GREENHUB_STANDALONE_BOOKING_PRODUCT_ID,
        seller_user_id: null,
        pickup_address: pickupQuery.trim(),
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_address: dropoffQuery.trim(),
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        contact_phone: contactPhone.trim(),
        rider_note: riderNote,
        source: "home_ride",
        status: "pending",
      };
      const { data: inserted, error } = await supabase.from("product_ride_bookings").insert(payload).select("id").maybeSingle();
      if (error) throw error;
      const newId = inserted && typeof (inserted as { id?: unknown }).id === "string" ? (inserted as { id: string }).id : "";
      toast.success("Looking for a rider…", { description: "We’ll notify you when someone accepts." });
      if (newId) navigate(`/bookings/${encodeURIComponent(newId)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit booking.");
    } finally {
      setSubmitting(false);
    }
  }, [
    authUser?.id,
    contactPhone,
    dropoffLat,
    dropoffLng,
    dropoffQuery,
    navigate,
    note,
    pickupLat,
    pickupLng,
    pickupQuery,
    vehicle,
  ]);

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">Book a Ride</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Choose vehicle and route. Confirm stops from suggestions for accurate pricing.</p>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => setVehicle("bike")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
            vehicle === "bike"
              ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
              : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
          }`}
        >
          Bike
        </button>
        <button
          type="button"
          onClick={() => setVehicle("car")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
            vehicle === "car"
              ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
              : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
          }`}
        >
          Car
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-foreground">Pickup</label>
          <div className="flex gap-2">
            <input
              value={pickupQuery}
              onChange={(e) => setPickupQuery(e.target.value)}
              placeholder="Search area (min 3 characters)"
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
          {searchingPickup ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : null}
          {pickupSuggestions.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {pickupSuggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}-${s.display_name}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white dark:hover:bg-zinc-700"
                    onClick={() => {
                      setPickupQuery(s.display_name);
                      setPickupLat(s.lat);
                      setPickupLng(s.lng);
                      setPickupSuggestions([]);
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
          {searchingDropoff ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : null}
          {dropoffSuggestions.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {dropoffSuggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}-${s.display_name}-d`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white dark:hover:bg-zinc-700"
                    onClick={() => {
                      setDropoffQuery(s.display_name);
                      setDropoffLat(s.lat);
                      setDropoffLng(s.lng);
                      setDropoffSuggestions([]);
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
