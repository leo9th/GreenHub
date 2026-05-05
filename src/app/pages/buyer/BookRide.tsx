import { FormEvent, Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowUpDown,
  CalendarDays,
  CheckCircle,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  ShieldCheck,
  X,
} from "@/app/icons/emojiLucide";
import { toast } from "sonner";
const DeliveryTrackingMapPreview = lazy(() => import("../../components/maps/DeliveryTrackingMap"));
const DeliveryTrackingMapEditor = lazy(() => import("../../components/maps/DeliveryTrackingMapEditor"));
const DeliveryTrackingMapEditorMapLibre = lazy(() => import("../../components/maps/DeliveryTrackingMapEditor"));

const USE_MAPLIBRE_EDITOR = true;

type PackageType = "small" | "medium" | "large" | "xlarge";

type AssignedRiderInfo = {
  name: string;
  vehicle: string;
  eta: string;
};

type RideStatus = "idle" | "searching" | "assigned" | "arriving" | "arrived" | "started" | "completed";

type LocationSuggestion = {
  /** Stable key when suggestions come from Mapbox */
  id?: string;
  display_name: string;
  lat: number;
  lng: number;
};

type RoutePointSource = "none" | "suggestion" | "gps" | "map";

function normRouteAddr(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapboxAccessToken(): string | undefined {
  const t = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const trimmed = t?.trim();
  return trimmed || undefined;
}

async function searchMapboxPlacesNg(query: string): Promise<LocationSuggestion[]> {
  const token = mapboxAccessToken();
  if (!token) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=ng&limit=8&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load address suggestions.");
  const data = (await res.json()) as {
    features?: Array<{ id: string; place_name: string; center: [number, number] }>;
  };
  return (data.features ?? [])
    .map((f) => ({
      id: f.id,
      display_name: String(f.place_name || "").trim(),
      lat: f.center[1],
      lng: f.center[0],
    }))
    .filter((r) => r.display_name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

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
  const location = useLocation();
  const rideType =
    location.state && typeof location.state === "object"
      ? location.state.rideType ?? null
      : null;

  if (!rideType) {
    console.warn("No rideType provided");
  }
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const mapModalContainerRef = useRef<HTMLDivElement | null>(null);
  const hasToastedArrivalRef = useRef(false);
  const assignTimerRef = useRef<number | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapSessionId, setMapSessionId] = useState(0);
  const [mapInteractionMode, setMapInteractionMode] = useState<"fixedPin" | "markers">("fixedPin");
  const [activeField, setActiveField] = useState<"pickup" | "dropoff">("pickup");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [pickupSource, setPickupSource] = useState<RoutePointSource>("none");
  const [dropoffSource, setDropoffSource] = useState<RoutePointSource>("none");
  const [pickupAnchorText, setPickupAnchorText] = useState("");
  const [dropoffAnchorText, setDropoffAnchorText] = useState("");
  const [packageType, setPackageType] = useState<PackageType>("small");
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [assignedRider, setAssignedRider] = useState<AssignedRiderInfo | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [searchStep, setSearchStep] = useState(0);
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
  const suggestMinLen = useMemo(() => (mapboxAccessToken() ? 2 : 3), []);

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
        const resolved = label?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setPickupAddress(resolved);
        setPickupSource("gps");
        setPickupAnchorText(resolved);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    return undefined;
  }, []);

  const runPickupSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    const useMapbox = Boolean(mapboxAccessToken());
    const minLen = useMapbox ? 2 : 3;
    if (trimmed.length < minLen) {
      setPickupSuggestions([]);
      return;
    }
    setIsSearchingPickup(true);
    try {
      const rows = useMapbox ? await searchMapboxPlacesNg(trimmed) : await searchAddressSuggestions(trimmed);
      setPickupSuggestions(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setPickupSuggestions([]);
    } finally {
      setIsSearchingPickup(false);
    }
  }, []);

  const runDropoffSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    const useMapbox = Boolean(mapboxAccessToken());
    const minLen = useMapbox ? 2 : 3;
    if (trimmed.length < minLen) {
      setDropoffSuggestions([]);
      return;
    }
    setIsSearchingDropoff(true);
    try {
      const rows = useMapbox ? await searchMapboxPlacesNg(trimmed) : await searchAddressSuggestions(trimmed);
      setDropoffSuggestions(rows);
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
        const resolved = label?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setPickupAddress(resolved);
        setPickupSource("gps");
        setPickupAnchorText(resolved);
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
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      toast.error("Select pickup and dropoff from suggestions or use GPS so we can locate you accurately");
      return;
    }
    pushRecentLocation(pickupAddress);
    pushRecentLocation(dropoffAddress);
    setRecentLocations(readRecentLocations());
    /** Ride stays on-page — no checkout / Paystack (avoids payment-before-ride errors). */
    setShowConfirmSheet(true);
  }, [dropoffAddress, dropoffLat, dropoffLng, pickupAddress, pickupLat, pickupLng]);

  const openExpandedMap = useCallback((field: "pickup" | "dropoff") => {
    setActiveField(field);
    setDraftPickup({ lat: pickupLat, lng: pickupLng });
    setDraftDropoff({ lat: dropoffLat, lng: dropoffLng });
    setMapSessionId((prev) => prev + 1);
    setIsMapExpanded(true);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const handleMapDemoArrival = useCallback(() => {
    setRideStatus((prev) => {
      if (prev === "arrived" || prev === "started" || prev === "completed") return prev;
      if (!hasToastedArrivalRef.current) {
        hasToastedArrivalRef.current = true;
        toast.success("Rider reached your destination.");
      }
      return "arrived";
    });
  }, []);

  const handleMockRiderAssigned = useCallback((stage?: "assigned" | "arriving") => {
    if (stage === "arriving") {
      setRideStatus((prev) => (prev === "assigned" ? "arriving" : prev));
      return;
    }

    if (assignTimerRef.current != null) {
      window.clearTimeout(assignTimerRef.current);
      assignTimerRef.current = null;
    }
    setRideStatus((prev) => (prev === "searching" ? "assigned" : prev));
    setIsSearching(false);
    setAssignedRider((prev) =>
      prev ?? {
        name: "John Rider",
        vehicle: rideType === "bike" ? "Bike" : "Car",
        eta: "3 mins",
      },
    );
  }, [rideType]);

  useEffect(() => {
    if (rideStatus === "searching") {
      hasToastedArrivalRef.current = false;
    }
  }, [rideStatus]);

  useEffect(() => {
    if (rideStatus !== "arrived") return;

    const t = window.setTimeout(() => {
      setRideStatus((prev) => (prev === "arrived" ? "started" : prev));
    }, 2000);

    return () => window.clearTimeout(t);
  }, [rideStatus]);

  useEffect(() => {
    if (rideStatus !== "started") return;

    const t = window.setTimeout(() => {
      setRideStatus((prev) => (prev === "started" ? "completed" : prev));
    }, 8000);

    return () => window.clearTimeout(t);
  }, [rideStatus]);

  useEffect(() => {
    if (rideStatus !== "completed") return;

    const t = window.setTimeout(() => {
      setAssignedRider(null);
      setRideStatus("idle");
      setIsSearching(false);
    }, 2000);

    return () => window.clearTimeout(t);
  }, [rideStatus]);

  const applyDraftToActiveField = useCallback(async () => {
    setIsResolvingAddress(true);
    if (activeField === "pickup") {
      setPickupLat(draftPickup.lat);
      setPickupLng(draftPickup.lng);
      if (draftPickup.lat != null && draftPickup.lng != null) {
        const label = await reverseGeocode(draftPickup.lat, draftPickup.lng);
        const resolved = label?.trim() || `${draftPickup.lat.toFixed(5)}, ${draftPickup.lng.toFixed(5)}`;
        setPickupAddress(resolved);
        setPickupSource("map");
        setPickupAnchorText(resolved);
        toast.success("Pickup location saved");
      }
      setIsResolvingAddress(false);
      return;
    }
    setDropoffLat(draftDropoff.lat);
    setDropoffLng(draftDropoff.lng);
    if (draftDropoff.lat != null && draftDropoff.lng != null) {
      const label = await reverseGeocode(draftDropoff.lat, draftDropoff.lng);
      const resolved = label?.trim() || `${draftDropoff.lat.toFixed(5)}, ${draftDropoff.lng.toFixed(5)}`;
      setDropoffAddress(resolved);
      setDropoffSource("map");
      setDropoffAnchorText(resolved);
      toast.success("Dropoff location saved");
    }
    setIsResolvingAddress(false);
  }, [activeField, draftDropoff.lat, draftDropoff.lng, draftPickup.lat, draftPickup.lng]);

  const expandedPickupLat = draftPickup.lat ?? pickupLat;
  const expandedPickupLng = draftPickup.lng ?? pickupLng;
  const expandedDropoffLat = draftDropoff.lat ?? dropoffLat;
  const expandedDropoffLng = draftDropoff.lng ?? dropoffLng;
  const pickupLocation = pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null;
  const dropoffLocation = dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null;
  const canContinue = Boolean(pickupLocation && dropoffLocation);

  useEffect(() => {
    if (!showConfirmSheet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmSheet(false);
      }

      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showConfirmSheet]);

  useEffect(() => {
    if (showConfirmSheet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showConfirmSheet]);

  useEffect(() => {
    if (!showConfirmSheet) return;
    confirmBtnRef.current?.focus();
  }, [showConfirmSheet]);

  useEffect(() => {
    if (showConfirmSheet) return;
    continueBtnRef.current?.focus();
  }, [showConfirmSheet]);

  useEffect(() => {
    if (!isSearching) return;

    const steps = [
      "Finding nearby riders...",
      "Matching you with the best driver...",
      "Almost there...",
    ];

    setSearchStep(0);

    const timers = steps.map((_, i) => setTimeout(() => setSearchStep(i), i * 2000));

    return () => timers.forEach(clearTimeout);
  }, [isSearching]);

  useEffect(() => {
    if (!isSearching) {
      if (assignTimerRef.current != null) {
        window.clearTimeout(assignTimerRef.current);
        assignTimerRef.current = null;
      }
      return;
    }

    if (assignTimerRef.current != null) {
      window.clearTimeout(assignTimerRef.current);
      assignTimerRef.current = null;
    }

    assignTimerRef.current = window.setTimeout(() => {
      assignTimerRef.current = null;
      setIsSearching(false);
      setRideStatus((prev) => (prev === "searching" ? "assigned" : prev));
      setAssignedRider((r) =>
        r ?? {
          name: "John Rider",
          vehicle: rideType === "bike" ? "Bike" : "Car",
          eta: "3 mins",
        },
      );
    }, 6000);

    return () => {
      if (assignTimerRef.current != null) {
        window.clearTimeout(assignTimerRef.current);
        assignTimerRef.current = null;
      }
    };
  }, [isSearching, rideType]);

  useEffect(() => {
    if (!isMapExpanded || !mapModalContainerRef.current) return undefined;

    const triggerMapResize = () => {
      const mapCanvas = mapModalContainerRef.current?.querySelector(".maplibregl-map") as HTMLElement | null;
      if (!mapCanvas) return;
      window.dispatchEvent(new Event("resize"));
    };

    const delayedResize = window.setTimeout(triggerMapResize, 140);
    const rafResize = window.requestAnimationFrame(triggerMapResize);

    return () => {
      window.clearTimeout(delayedResize);
      window.cancelAnimationFrame(rafResize);
    };
  }, [isMapExpanded]);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 pb-28 md:px-4 md:py-6 md:pb-32">
      {rideType && (
        <div className="px-4 py-2 text-sm text-gray-600">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              rideType === "bike" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
            }`}
          >
            <span aria-hidden>{rideType === "bike" ? "🏍️" : "🚗"}</span>
            <span className="capitalize">{rideType}</span>
          </span>
        </div>
      )}
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-5 text-white md:px-6">
          <h1 className="text-xl font-bold tracking-tight">Book GreenGo</h1>
          <p className="mt-1 text-sm font-medium text-emerald-50">Choose ride mode and confirm your trip in seconds.</p>
        </div>

        <form className="space-y-6 p-4 md:p-6" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4 dark:border-gray-700 dark:bg-gray-900">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Route</label>
            <div className="relative mt-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-950/60">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pickup</p>
              <div className="mt-1 flex gap-2">
                <input
                  value={pickupAddress}
                  onFocus={() => setActiveField("pickup")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPickupAddress(v);
                    setActiveField("pickup");
                    if (
                      pickupLat != null &&
                      pickupLng != null &&
                      pickupAnchorText &&
                      normRouteAddr(v) !== normRouteAddr(pickupAnchorText)
                    ) {
                      setPickupLat(null);
                      setPickupLng(null);
                      setPickupSource("none");
                      setPickupAnchorText("");
                    }
                  }}
                  placeholder="Enter pickup address"
                  className="w-full bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 rounded-lg border border-gray-200 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
                  required
                />
                  <button
                    type="button"
                    onClick={() => void runPickupSearch(pickupAddress)}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                  {isSearchingPickup ? "..." : "Find"}
                </button>
              </div>
              {pickupAddress.trim().length >= suggestMinLen && (pickupLat == null || pickupLng == null) ? (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">Please select a location from the list</p>
              ) : null}
              {pickupLat != null && pickupLng != null ? (
                pickupSource === "gps" ? (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Using current location</p>
                ) : (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Location confirmed
                  </p>
                )
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const nextPickupAddress = dropoffAddress;
                  const nextDropoffAddress = pickupAddress;
                  const nextPickupLat = dropoffLat;
                  const nextPickupLng = dropoffLng;
                  const nextDropoffLat = pickupLat;
                  const nextDropoffLng = pickupLng;
                  const nextPickupSource = dropoffSource;
                  const nextDropoffSource = pickupSource;
                  const nextPickupAnchor = dropoffAnchorText;
                  const nextDropoffAnchor = pickupAnchorText;
                  setPickupAddress(nextPickupAddress);
                  setDropoffAddress(nextDropoffAddress);
                  setPickupLat(nextPickupLat);
                  setPickupLng(nextPickupLng);
                  setDropoffLat(nextDropoffLat);
                  setDropoffLng(nextDropoffLng);
                  setPickupSource(nextPickupSource);
                  setDropoffSource(nextDropoffSource);
                  setPickupAnchorText(nextPickupAnchor);
                  setDropoffAnchorText(nextDropoffAnchor);
                }}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="Swap pickup and dropoff"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>

              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Drop-off</p>
                <div className="mt-1 flex gap-2">
                  <input
                    value={dropoffAddress}
                    onFocus={() => setActiveField("dropoff")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDropoffAddress(v);
                      setActiveField("dropoff");
                      if (
                        dropoffLat != null &&
                        dropoffLng != null &&
                        dropoffAnchorText &&
                        normRouteAddr(v) !== normRouteAddr(dropoffAnchorText)
                      ) {
                        setDropoffLat(null);
                        setDropoffLng(null);
                        setDropoffSource("none");
                        setDropoffAnchorText("");
                      }
                    }}
                    placeholder="Enter dropoff address"
                    className="w-full bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 rounded-lg border border-gray-200 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => void runDropoffSearch(dropoffAddress)}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {isSearchingDropoff ? "..." : "Find"}
                  </button>
                </div>
                {dropoffAddress.trim().length >= suggestMinLen && (dropoffLat == null || dropoffLng == null) ? (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">Please select a location from the list</p>
                ) : null}
                {dropoffLat != null && dropoffLng != null ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Location confirmed
                  </p>
                ) : null}
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
              <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {pickupSuggestions.map((s, idx) => (
                  <button
                    key={s.id ?? `${s.lat}-${s.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setPickupAddress(s.display_name);
                      setPickupLat(s.lat);
                      setPickupLng(s.lng);
                      setPickupSource("suggestion");
                      setPickupAnchorText(s.display_name);
                      setPickupSuggestions([]);
                    }}
                    className="block w-full cursor-pointer border-b border-gray-100 px-3 py-3 text-left text-sm text-gray-800 last:border-0 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            ) : null}
            {dropoffSuggestions.length > 0 ? (
              <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {dropoffSuggestions.map((s, idx) => (
                  <button
                    key={s.id ?? `${s.lat}-${s.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setDropoffAddress(s.display_name);
                      setDropoffLat(s.lat);
                      setDropoffLng(s.lng);
                      setDropoffSource("suggestion");
                      setDropoffAnchorText(s.display_name);
                      setDropoffSuggestions([]);
                    }}
                    className="block w-full cursor-pointer border-b border-gray-100 px-3 py-3 text-left text-sm text-gray-800 last:border-0 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200">
            {rideType ? (
              <div className="px-3 pt-3">
                <p className="text-base font-semibold text-gray-900">
                  {rideType === "bike" ? "Bike ride selected" : "Car ride selected"}
                </p>
              </div>
            ) : null}
            <Suspense fallback={<div className="h-[340px] w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
              <DeliveryTrackingMapPreview
                pickupLocation={pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null}
                dropoffLocation={dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null}
                className="h-[340px] w-full rounded-xl shadow-sm"
                onArrival={rideStatus === "assigned" || rideStatus === "arriving" ? handleMapDemoArrival : undefined}
                onMockRiderAssigned={
                  rideStatus === "searching" || rideStatus === "assigned" || rideStatus === "arriving"
                    ? handleMockRiderAssigned
                    : undefined
                }
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
                        setPickupLat(null);
                        setPickupLng(null);
                        setPickupSource("none");
                        setPickupAnchorText("");
                      } else {
                        setDropoffAddress(loc);
                        setDropoffLat(null);
                        setDropoffLng(null);
                        setDropoffSource("none");
                        setDropoffAnchorText("");
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
              disabled={!canContinue}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-base font-extrabold text-white hover:from-emerald-700 hover:to-emerald-600 disabled:pointer-events-none disabled:opacity-50"
            >
              {`Book ${selectedRide.name}`}
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
        <div className="fixed inset-0 z-50 overflow-auto bg-black/45 p-3 sm:p-5">
          <div ref={mapModalContainerRef} className="mx-auto flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
            <div className="relative flex-1 min-h-[400px] w-full overflow-hidden p-0">
              <div className="relative h-full w-full">
              <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
                {USE_MAPLIBRE_EDITOR ? (
                  <DeliveryTrackingMapEditorMapLibre
                    key={`maplibre-editor-${mapSessionId}`}
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
                    onMapCenterChange={(lat: number, lng: number) => {
                      if (activeField === "pickup") {
                        setDraftPickup({ lat, lng });
                      } else {
                        setDraftDropoff({ lat, lng });
                      }
                    }}
                    onPickupChange={(lat: number, lng: number) => setDraftPickup({ lat, lng })}
                    onDropoffChange={(lat: number, lng: number) => setDraftDropoff({ lat, lng })}
                  />
                ) : (
                  <DeliveryTrackingMapEditor
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
                )}
              </Suspense>
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
        </div>
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-[75] border-t border-gray-200 bg-white px-4 py-3 shadow-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            {rideType ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  rideType === "bike" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                <span aria-hidden>{rideType === "bike" ? "🏍️" : "🚗"}</span>
                <span className="capitalize">{rideType}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <span>Select ride type</span>
              </span>
            )}
            <p className="mt-1 text-xs text-gray-500">Set pickup and dropoff to continue</p>
          </div>
          <button
            type="button"
            disabled={!canContinue}
            ref={continueBtnRef}
            onClick={() => {
              if (!pickupLocation || !dropoffLocation) return;
              setShowConfirmSheet(true);
            }}
            className={`rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white ${
              canContinue ? "opacity-100" : "opacity-60 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      </div>
      {showConfirmSheet && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={() => setShowConfirmSheet(false)}>
          <div ref={sheetRef} tabIndex={-1} className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
            <h3 className="mb-2 text-base font-semibold">Confirm your ride</h3>
            <div className="mb-3 text-sm text-gray-600">{rideType === "bike" ? "Bike ride" : "Car ride"}</div>
            <div className="mb-4 text-sm text-gray-500">Pickup and destination selected</div>
            <button
              ref={confirmBtnRef}
              className="w-full rounded-lg bg-green-600 py-3 text-white"
              onClick={() => {
                setShowConfirmSheet(false);
                setAssignedRider(null);
                setRideStatus("searching");
                setIsSearching(true);
              }}
            >
              Confirm Ride
            </button>
            <button className="mt-2 w-full text-gray-500" onClick={() => setShowConfirmSheet(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {isSearching && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40">
          <div className="w-[85%] max-w-sm rounded-xl bg-white p-6 text-center">
            <div className="mb-4 text-lg font-semibold">Searching for rider...</div>
            <div className="mb-4 text-sm text-gray-500">
              {[
                "Finding nearby riders...",
                "Matching you with the best driver...",
                "Almost there...",
              ][searchStep]}
            </div>
            <div className="mb-4 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            </div>
            <button className="text-sm text-gray-500" onClick={() => {
              setIsSearching(false);
              setRideStatus("idle");
            }}>
              Cancel search
            </button>
          </div>
        </div>
      )}
      {assignedRider && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40">
          <div className="w-[85%] max-w-sm rounded-xl bg-white p-6">
            <div className="mb-2 text-lg font-semibold">
              {rideStatus === "completed"
                ? "Thanks for riding"
                : rideStatus === "started"
                  ? "Ride in progress"
                  : rideStatus === "arrived"
                    ? "You've arrived"
                    : rideStatus === "arriving"
                      ? "Driver arriving…"
                      : "Rider found 🎉"}
            </div>
            <div className="mb-4 text-sm text-gray-500">
              {rideStatus === "completed"
                ? "Your trip is complete."
                : rideStatus === "started"
                  ? "Enjoy the rest of your journey."
                  : rideStatus === "arrived"
                    ? "Your rider has reached the destination."
                    : rideStatus === "arriving"
                      ? "Your driver is almost at pickup."
                      : "Your rider is on the way"}
            </div>
            {rideStatus === "started" ? (
              <p className="mb-3 text-sm font-medium text-emerald-700">Ride in progress...</p>
            ) : null}
            {rideStatus === "completed" ? (
              <p className="mb-3 text-sm font-medium text-emerald-700">Ride completed 🎉</p>
            ) : null}
            <div className="mb-4 rounded-lg bg-gray-100 p-3">
              <div className="font-medium">{assignedRider.name}</div>
              <div className="text-sm text-gray-500">
                {assignedRider.vehicle} • {assignedRider.eta}
              </div>
            </div>
            {rideStatus === "assigned" || rideStatus === "arriving" ? (
              <button
                className="w-full rounded-lg bg-green-600 py-3 text-white"
                onClick={() => {
                  setAssignedRider(null);
                  setRideStatus("idle");
                }}
              >
                Track Ride
              </button>
            ) : null}
            {rideStatus === "arrived" ? (
              <button
                type="button"
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white"
                onClick={() => setRideStatus((prev) => (prev === "arrived" ? "started" : prev))}
              >
                Start Ride
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
export default memo(BookRide);

