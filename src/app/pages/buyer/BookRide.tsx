import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, MapPin, Navigation, X } from "lucide-react";
import { toast } from "sonner";
import DeliveryTrackingMap from "../../components/DeliveryTrackingMap";

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

export default function BookRide() {
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

  const runPickupSearch = async () => {
    setIsSearchingPickup(true);
    try {
      setPickupSuggestions(await searchAddressSuggestions(pickupAddress));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setPickupSuggestions([]);
    } finally {
      setIsSearchingPickup(false);
    }
  };

  const runDropoffSearch = async () => {
    setIsSearchingDropoff(true);
    try {
      setDropoffSuggestions(await searchAddressSuggestions(dropoffAddress));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setDropoffSuggestions([]);
    } finally {
      setIsSearchingDropoff(false);
    }
  };

  const useCurrentLocation = () => {
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
  };

  const handleSubmit = (e: FormEvent) => {
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
  };

  const openExpandedMap = (field: "pickup" | "dropoff") => {
    setActiveField(field);
    setDraftPickup({ lat: pickupLat, lng: pickupLng });
    setDraftDropoff({ lat: dropoffLat, lng: dropoffLng });
    setIsMapExpanded(true);
  };

  const applyDraftToActiveField = async () => {
    setIsResolvingAddress(true);
    if (activeField === "pickup") {
      setPickupLat(draftPickup.lat);
      setPickupLng(draftPickup.lng);
      if (draftPickup.lat != null && draftPickup.lng != null) {
        const label = await reverseGeocode(draftPickup.lat, draftPickup.lng);
        if (label) setPickupAddress(label);
      }
      setIsResolvingAddress(false);
      return;
    }
    setDropoffLat(draftDropoff.lat);
    setDropoffLng(draftDropoff.lng);
    if (draftDropoff.lat != null && draftDropoff.lng != null) {
      const label = await reverseGeocode(draftDropoff.lat, draftDropoff.lng);
      if (label) setDropoffAddress(label);
    }
    setIsResolvingAddress(false);
  };

  const expandedPickupLat = draftPickup.lat ?? pickupLat;
  const expandedPickupLng = draftPickup.lng ?? pickupLng;
  const expandedDropoffLat = draftDropoff.lat ?? dropoffLat;
  const expandedDropoffLng = draftDropoff.lng ?? dropoffLng;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Book a Ride</h1>
        <p className="mt-1 text-sm text-gray-500">Request pickup and delivery, then continue to checkout.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Pickup location</label>
            <div className="flex gap-2">
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
              <button type="button" onClick={() => void runPickupSearch()} className="rounded-lg border border-gray-300 px-3 text-xs font-semibold">
                {isSearchingPickup ? "..." : "Find"}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Navigation className="h-3.5 w-3.5" /> Use current location
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Dropoff location</label>
            <div className="flex gap-2">
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
              <button type="button" onClick={() => void runDropoffSearch()} className="rounded-lg border border-gray-300 px-3 text-xs font-semibold">
                {isSearchingDropoff ? "..." : "Find"}
              </button>
            </div>
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

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Package size</label>
            <div className="flex gap-2 overflow-x-auto">
              {(["small", "medium", "large", "xlarge"] as PackageType[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPackageType(size)}
                  className={`rounded-lg px-3 py-2 text-sm capitalize ${
                    packageType === size
                      ? "bg-gray-300 font-bold text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {size === "xlarge" ? "XL" : size}
                </button>
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

          <div className="relative overflow-hidden rounded-xl border border-gray-200">
            <DeliveryTrackingMap
              pickupLat={pickupLat}
              pickupLng={pickupLng}
              dropoffLat={dropoffLat}
              dropoffLng={dropoffLng}
              className="h-[200px] w-full"
            />
            <button
              type="button"
              onClick={() => openExpandedMap(activeField)}
              className="absolute right-3 top-3 rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200"
            >
              ⛶ Expand Map
            </button>
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

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue to Checkout
          </button>
        </form>
      </div>
      {isMapExpanded ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-3 sm:px-4">
            <button
              type="button"
              onClick={() => setIsMapExpanded(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
              aria-label="Close map"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMapInteractionMode("fixedPin");
                  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                }}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${
                  mapInteractionMode === "fixedPin" ? "bg-gray-300 text-gray-900" : "bg-gray-100 text-gray-600"
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
                  mapInteractionMode === "markers" ? "bg-gray-300 text-gray-900" : "bg-gray-100 text-gray-600"
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
              <DeliveryTrackingMap
                pickupLat={expandedPickupLat}
                pickupLng={expandedPickupLng}
                dropoffLat={expandedDropoffLat}
                dropoffLng={expandedDropoffLng}
                className="h-full w-full rounded-xl"
                interactive
                interactionMode={mapInteractionMode}
                activeField={activeField}
                showRoute
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

