import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, MapPin, Navigation } from "lucide-react";
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
                onChange={(e) => setPickupAddress(e.target.value)}
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
                onChange={(e) => setDropoffAddress(e.target.value)}
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
            <select
              value={packageType}
              onChange={(e) => setPackageType(e.target.value as PackageType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra Large</option>
            </select>
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

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <DeliveryTrackingMap
              pickupLat={pickupLat}
              pickupLng={pickupLng}
              dropoffLat={dropoffLat}
              dropoffLng={dropoffLng}
              className="h-64 w-full"
            />
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
    </div>
  );
}

