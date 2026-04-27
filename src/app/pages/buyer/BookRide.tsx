import { FormEvent, Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpDown, CalendarDays, Clock3, Loader2, MapPin, Navigation, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
const DeliveryTrackingMap = lazy(() => import("../../components/DeliveryTrackingMap"));

type PackageType = "small" | "medium" | "large" | "xlarge";

type LocationSuggestion = {
  display_name: string;
  lat: number;
  lng: number;
};

const PACKAGE_MULTIPLIER: Record<PackageType, number> = {
  small: 1,
  medium: 1.2,
  large: 1.5,
  xlarge: 1.9,
};

const RIDE_OPTIONS: Array<{
  type: PackageType;
  name: string;
  seats: number;
  etaLabel: string;
  description: string;
}> = [
  { type: "small", name: "GreenGo", seats: 4, etaLabel: "2 - 4 min", description: "Affordable everyday rides" },
  { type: "medium", name: "GreenComfort", seats: 4, etaLabel: "3 - 6 min", description: "Extra comfort and space" },
  { type: "large", name: "GreenPremium", seats: 4, etaLabel: "4 - 7 min", description: "Premium rides, top quality" },
  { type: "xlarge", name: "GreenXL", seats: 6, etaLabel: "5 - 8 min", description: "For groups and larger trips" },
];

const RECENT_LOCATIONS_KEY = "gh_recent_ride_locations";

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const p =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}

async function searchAddressSuggestions(query: string): Promise<LocationSuggestion[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Could not load address suggestions.");
  const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return rows
    .map((r) => ({
      display_name: String(r.display_name || "").trim(),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((r) => r.display_name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  return data.display_name?.trim() || null;
}

function readRecentLocations(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_LOCATIONS_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.filter((r): r is string => typeof r === "string" && r.trim().length > 0).slice(0, 5);
  } catch {
    return [];
  }
}

function pushRecentLocation(value: string) {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const next = [trimmed, ...readRecentLocations().filter((x) => x !== trimmed)].slice(0, 5);
  window.localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
}

function RideOptionCard({
  ride,
  distanceKm,
  selected,
  onSelect,
}: {
  ride: (typeof RIDE_OPTIONS)[number];
  distanceKm: number | null;
  selected: boolean;
  onSelect: (type: PackageType) => void;
}) {
  const ridePrice = useMemo(
    () => (distanceKm == null ? null : Math.round((1500 + distanceKm * 320) * PACKAGE_MULTIPLIER[ride.type])),
    [distanceKm, ride.type],
  );
  return (
    <button
      type="button"
      onClick={() => onSelect(ride.type)}
      className={`flex min-h-[92px] w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
        selected
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30"
      }`}
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{ride.name}</p>
        <p className="text-xs text-gray-500">{ride.description}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
          <Clock3 className="h-3.5 w-3.5 text-emerald-600" /> {ride.etaLabel} · {ride.seats} seats
        </p>
      </div>
      <p className="text-base font-bold text-emerald-700">{ridePrice == null ? "—" : `NGN ${ridePrice.toLocaleString()}`}</p>
    </button>
  );
}
const MemoRideOptionCard = memo(RideOptionCard);

function BookRide() {
  const navigate = useNavigate();
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapInteractionMode, setMapInteractionMode] = useState<"fixedPin" | "markers">("fixedPin");
  const [activeField, setActiveField] = useState<"pickup" | "dropoff">("pickup");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [packageType, setPackageType] = useState<PackageType>("small");
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [draftPickup, setDraftPickup] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [draftDropoff, setDraftDropoff] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  const [recentLocations, setRecentLocations] = useState<string[]>(() => readRecentLocations());

  const distanceKm = useMemo(() => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) return null;
    return haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const estimatedPrice = useMemo(() => {
    if (distanceKm == null) return null;
    const base = 1500;
    const distanceCost = distanceKm * 320;
    return Math.round((base + distanceCost) * PACKAGE_MULTIPLIER[packageType]);
  }, [distanceKm, packageType]);
  const selectedRide = useMemo(() => RIDE_OPTIONS.find((r) => r.type === packageType) ?? RIDE_OPTIONS[0], [packageType]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickupLat(lat);
        setPickupLng(lng);
        setDraftPickup({ lat, lng });
        const label = await reverseGeocode(lat, lng);
        if (label) setPickupAddress(label);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    return undefined;
  }, []);

  const runPickupSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setPickupSuggestions([]);
      return;
    }
    setIsSearchingPickup(true);
    try {
      setPickupSuggestions(await searchAddressSuggestions(query));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setPickupSuggestions([]);
    } finally {
      setIsSearchingPickup(false);
    }
  }, []);

  const runDropoffSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setDropoffSuggestions([]);
      return;
    }
    setIsSearchingDropoff(true);
    try {
      setDropoffSuggestions(await searchAddressSuggestions(query));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setDropoffSuggestions([]);
    } finally {
      setIsSearchingDropoff(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runPickupSearch(pickupAddress);
    }, 300);
    return () => window.clearTimeout(t);
  }, [pickupAddress, runPickupSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runDropoffSearch(dropoffAddress);
    }, 300);
    return () => window.clearTimeout(t);
  }, [dropoffAddress, runDropoffSearch]);

  const useCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickupLat(lat);
        setPickupLng(lng);
        const label = await reverseGeocode(lat, lng);
        if (label) setPickupAddress(label);
        toast.success("Pickup set from current location.");
      },
      (err) => {
        toast.error(err.message || "Could not access your location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      toast.error("Pickup and dropoff are required.");
      return;
    }
    setSubmitting(true);
    pushRecentLocation(pickupAddress);
    pushRecentLocation(dropoffAddress);
    setRecentLocations(readRecentLocations());

    navigate("/checkout", {
      state: {
        rideBookingDraft: {
          pickupAddress: pickupAddress.trim(),
          pickupLat,
          pickupLng,
          dropoffAddress: dropoffAddress.trim(),
          dropoffLat,
          dropoffLng,
          packageType,
          distanceKm,
          estimatedPrice,
          source: "book_page",
        },
      },
    });
  }, [dropoffAddress, dropoffLat, dropoffLng, estimatedPrice, distanceKm, navigate, packageType, pickupAddress, pickupLat, pickupLng]);

  const openExpandedMap = useCallback((field: "pickup" | "dropoff") => {
    setActiveField(field);
    setDraftPickup({ lat: pickupLat, lng: pickupLng });
    setDraftDropoff({ lat: dropoffLat, lng: dropoffLng });
    setIsMapExpanded(true);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const applyDraftToActiveField = useCallback(async () => {
    setIsResolvingAddress(true);
    if (activeField === "pickup") {
      setPickupLat(draftPickup.lat);
      setPickupLng(draftPickup.lng);
      if (draftPickup.lat != null && draftPickup.lng != null) {
        const label = await reverseGeocode(draftPickup.lat, draftPickup.lng);
        if (label) setPickupAddress(label);
        toast.success("Pickup location saved");
      }
      setIsResolvingAddress(false);
      return;
    }
    setDropoffLat(draftDropoff.lat);
    setDropoffLng(draftDropoff.lng);
    if (draftDropoff.lat != null && draftDropoff.lng != null) {
      const label = await reverseGeocode(draftDropoff.lat, draftDropoff.lng);
      if (label) setDropoffAddress(label);
      toast.success("Dropoff location saved");
    }
    setIsResolvingAddress(false);
  }, [activeField, draftDropoff.lat, draftDropoff.lng, draftPickup.lat, draftPickup.lng]);

  const expandedPickupLat = draftPickup.lat ?? pickupLat;
  const expandedPickupLng = draftPickup.lng ?? pickupLng;
  const expandedDropoffLat = draftDropoff.lat ?? dropoffLat;
  const expandedDropoffLng = draftDropoff.lng ?? dropoffLng;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 md:px-4 md:py-6">
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-5 text-white md:px-6">
          <h1 className="text-xl font-bold tracking-tight">Book GreenGo</h1>
          <p className="mt-1 text-sm font-medium text-emerald-50">Choose ride mode and confirm your trip in seconds.</p>
        </div>

        <form className="space-y-6 p-4 md:p-6" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
            <label className="text-sm font-medium text-gray-800">Route</label>
            <div className="relative mt-2 rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Pickup</p>
              <div className="mt-1 flex gap-2">
                <input
                  value={pickupAddress}
                  onFocus={() => setActiveField("pickup")}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    setActiveField("pickup");
                  }}
                  placeholder="Enter pickup address"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
                  <button type="button" onClick={() => void runPickupSearch(pickupAddress)} className="rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700">
                  {isSearchingPickup ? "..." : "Find"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextPickupAddress = dropoffAddress;
                  const nextDropoffAddress = pickupAddress;
                  const nextPickupLat = dropoffLat;
                  const nextPickupLng = dropoffLng;
                  const nextDropoffLat = pickupLat;
                  const nextDropoffLng = pickupLng;
                  setPickupAddress(nextPickupAddress);
                  setDropoffAddress(nextDropoffAddress);
                  setPickupLat(nextPickupLat);
                  setPickupLng(nextPickupLng);
                  setDropoffLat(nextDropoffLat);
                  setDropoffLng(nextDropoffLng);
                }}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                aria-label="Swap pickup and dropoff"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">Drop-off</p>
                <div className="mt-1 flex gap-2">
                  <input
                    value={dropoffAddress}
                    onFocus={() => setActiveField("dropoff")}
                    onChange={(e) => {
                      setDropoffAddress(e.target.value);
                      setActiveField("dropoff");
                    }}
                    placeholder="Enter dropoff address"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <button type="button" onClick={() => void runDropoffSearch(dropoffAddress)} className="rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700">
                    {isSearchingDropoff ? "..." : "Find"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Navigation className="h-3.5 w-3.5" /> Use current location
              </button>
              <button
                type="button"
                onClick={() => openExpandedMap(activeField)}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                <MapPin className="h-3.5 w-3.5" /> Open map
              </button>
            </div>

            {pickupSuggestions.length > 0 ? (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-md border border-gray-200">
                {pickupSuggestions.map((s, idx) => (
                  <button
                    key={`${s.lat}-${s.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setPickupAddress(s.display_name);
                      setPickupLat(s.lat);
                      setPickupLng(s.lng);
                      setPickupSuggestions([]);
                    }}
                    className="block w-full border-b border-gray-100 px-2 py-1.5 text-left text-[11px] text-gray-700 last:border-0 hover:bg-gray-50"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            ) : null}
            {dropoffSuggestions.length > 0 ? (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-md border border-gray-200">
                {dropoffSuggestions.map((s, idx) => (
                  <button
                    key={`${s.lat}-${s.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setDropoffAddress(s.display_name);
                      setDropoffLat(s.lat);
                      setDropoffLng(s.lng);
                      setDropoffSuggestions([]);
                    }}
                    className="block w-full border-b border-gray-100 px-2 py-1.5 text-left text-[11px] text-gray-700 last:border-0 hover:bg-gray-50"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200">
            <Suspense fallback={<div className="h-[340px] w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
              <DeliveryTrackingMap
                pickupLat={pickupLat}
                pickupLng={pickupLng}
                dropoffLat={dropoffLat}
                dropoffLng={dropoffLng}
                className="h-[340px] w-full rounded-xl shadow-sm"
                showRoute
              />
            </Suspense>
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow">
              {distanceKm == null ? "Set route points" : `${distanceKm.toFixed(2)} km route`}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedRide.name}</p>
                    <p className="text-xs text-gray-500">{selectedRide.etaLabel} away</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-700">{estimatedPrice == null ? "—" : `NGN ${estimatedPrice.toLocaleString()}`}</p>
                    <p className="text-[11px] font-semibold text-gray-500">Cash</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Choose Ride Mode</label>
            <div className="space-y-3">
              {RIDE_OPTIONS.map((ride) => (
                <MemoRideOptionCard
                  key={ride.type}
                  ride={ride}
                  distanceKm={distanceKm}
                  selected={packageType === ride.type}
                  onSelect={setPackageType}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm md:grid-cols-2">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-800">Estimated distance:</span>{" "}
              {distanceKm == null ? "Set pickup & dropoff pins" : `${distanceKm.toFixed(2)} km`}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold text-gray-800">Estimated price:</span>{" "}
              {estimatedPrice == null ? "—" : `NGN ${estimatedPrice.toLocaleString()}`}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-emerald-800 md:grid-cols-4">
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4" /> Safe Rides
              </p>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <MapPin className="h-4 w-4" /> Live Tracking
              </p>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <Clock3 className="h-4 w-4" /> 24/7 Support
              </p>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <Navigation className="h-4 w-4" /> Eco Friendly
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment method</p>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-gray-900">Cash</p>
                <p className="text-xs text-gray-500">You can change at checkout</p>
              </div>
              <p className="text-xs font-semibold text-gray-500">Default</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Package size (advanced)</label>
            <div className="flex gap-2 overflow-x-auto">
              {(["small", "medium", "large", "xlarge"] as PackageType[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPackageType(size)}
                  className={`rounded-lg px-3 py-2 text-sm capitalize ${
                    packageType === size ? "bg-gray-900 font-bold text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {size === "xlarge" ? "XL" : size}
                </button>
              ))}
            </div>
          </div>

          {recentLocations.length > 0 ? (
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent locations</p>
              <div className="space-y-1.5">
                {recentLocations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      if (!pickupAddress.trim()) {
                        setPickupAddress(loc);
                      } else {
                        setDropoffAddress(loc);
                      }
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="line-clamp-1">{loc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-2 z-20 grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-gray-200 bg-white/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-base font-extrabold text-white hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Processing..." : `Book ${selectedRide.name}`}
            </button>
            <button
              type="button"
              className="inline-flex h-full min-h-[52px] w-[52px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              aria-label="Schedule ride"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
      {isMapExpanded ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur sm:px-4">
            <button
              type="button"
              onClick={() => setIsMapExpanded(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
              aria-label="Close map"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMapInteractionMode("fixedPin");
                  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                }}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${
                  mapInteractionMode === "fixedPin" ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600"
                }`}
              >
                Fixed Pin
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapInteractionMode("markers");
                  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                }}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${
                  mapInteractionMode === "markers" ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600"
                }`}
              >
                Markers
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActiveField((prev) => (prev === "pickup" ? "dropoff" : "pickup"))}
              className="min-h-11 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
            >
              Switch
            </button>
          </div>
          <div className="h-[calc(100vh-64px)] p-2 sm:p-3">
            <div className="relative h-full w-full">
              <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
                <DeliveryTrackingMap
                  pickupLat={expandedPickupLat}
                  pickupLng={expandedPickupLng}
                  dropoffLat={expandedDropoffLat}
                  dropoffLng={expandedDropoffLng}
                  className="h-full w-full rounded-xl shadow-sm"
                  interactive
                  interactionMode={mapInteractionMode}
                  activeField={activeField}
                  showRoute
                  followPosition={false}
                  onMapCenterChange={(lat, lng) => {
                    if (activeField === "pickup") {
                      setDraftPickup({ lat, lng });
                    } else {
                      setDraftDropoff({ lat, lng });
                    }
                  }}
                  onPickupChange={(lat, lng) => setDraftPickup({ lat, lng })}
                  onDropoffChange={(lat, lng) => setDraftDropoff({ lat, lng })}
                />
              </Suspense>
              <div className="pointer-events-none absolute left-3 top-3 z-[600] rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-gray-800 shadow">
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${activeField === "pickup" ? "bg-emerald-500" : "bg-violet-600"}`} />
                Editing {activeField === "pickup" ? "Pickup" : "Dropoff"}
              </div>
              <div className="pointer-events-none absolute bottom-16 left-1/2 z-[600] w-[90%] -translate-x-1/2 rounded-lg bg-black/45 px-3 py-2 text-center text-xs text-white">
                {mapInteractionMode === "fixedPin" ? "Drag map to position the pin" : "Drag markers to adjust locations"}
              </div>
              <button
                type="button"
                disabled={isResolvingAddress}
                onClick={async () => {
                  await applyDraftToActiveField();
                  setIsMapExpanded(false);
                }}
                className="absolute bottom-3 right-3 z-[700] inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                {isResolvingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isResolvingAddress ? "Finding address..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export default memo(BookRide);

