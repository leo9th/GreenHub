import { FormEvent, Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
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
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  type VehicleTierOption,
  VEHICLE_TIER_OPTIONS,
  createStandaloneRideBooking,
  defaultTierFromLegacyRideType,
  estimateRideFareNgn,
  formatNgn,
  haversineKm,
  pushRecentRideLocation,
  readRecentRideLocations,
  reverseGeocode,
  searchAddressesNg,
  suggestMinQueryLength,
} from "../../../modules/rider";

const DeliveryTrackingMapPreview = lazy(() => import("../../components/maps/DeliveryTrackingMap"));
const DeliveryTrackingMapEditor = lazy(() => import("../../components/maps/DeliveryTrackingMapEditor"));

type RoutePointSource = "none" | "suggestion" | "gps" | "map";

function normRouteAddr(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function RideOptionCard({
  ride,
  distanceKm,
  selected,
  onSelect,
}: {
  ride: VehicleTierOption;
  distanceKm: number | null;
  selected: boolean;
  onSelect: (id: (typeof VEHICLE_TIER_OPTIONS)[number]["id"]) => void;
}) {
  const ridePrice = useMemo(
    () => (distanceKm == null ? null : estimateRideFareNgn(distanceKm, ride.id)),
    [distanceKm, ride.id],
  );
  return (
    <button
      type="button"
      onClick={() => onSelect(ride.id)}
      className={`flex min-h-[92px] w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
        selected
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30"
      }`}
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{ride.label}</p>
        <p className="text-xs text-gray-500">{ride.description}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
          <Clock3 className="h-3.5 w-3.5 text-emerald-600" /> {ride.etaLabel} · {ride.seats}{" "}
          {ride.seats === 1 ? "rider" : "seats"}
        </p>
      </div>
      <p className="text-base font-bold text-emerald-700">{ridePrice == null ? "—" : formatNgn(ridePrice)}</p>
    </button>
  );
}
const MemoRideOptionCard = memo(RideOptionCard);

function BookRide() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const rideType =
    location.state && typeof location.state === "object" ? (location.state as { rideType?: string }).rideType ?? null : null;

  const initialTier = useMemo(() => defaultTierFromLegacyRideType(rideType), [rideType]);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const mapModalContainerRef = useRef<HTMLDivElement | null>(null);
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
  const [vehicleTier, setVehicleTier] = useState(initialTier);
  const [pickupSuggestions, setPickupSuggestions] = useState<Awaited<ReturnType<typeof searchAddressesNg>>>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<Awaited<ReturnType<typeof searchAddressesNg>>>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [draftPickup, setDraftPickup] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [draftDropoff, setDraftDropoff] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [contactPhone, setContactPhone] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [rideNote, setRideNote] = useState("");

  const [recentLocations, setRecentLocations] = useState<string[]>(() => readRecentRideLocations());

  const distanceKm = useMemo(() => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) return null;
    return haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const estimatedFareNgn = useMemo(() => {
    if (distanceKm == null) return null;
    return estimateRideFareNgn(distanceKm, vehicleTier);
  }, [distanceKm, vehicleTier]);
  const selectedRide = useMemo(
    () => VEHICLE_TIER_OPTIONS.find((r) => r.id === vehicleTier) ?? VEHICLE_TIER_OPTIONS[1],
    [vehicleTier],
  );
  const suggestMinLen = useMemo(() => suggestMinQueryLength(), []);

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
    if (trimmed.length < suggestMinLen) {
      setPickupSuggestions([]);
      return;
    }
    setIsSearchingPickup(true);
    try {
      const rows = await searchAddressesNg(trimmed);
      setPickupSuggestions(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setPickupSuggestions([]);
    } finally {
      setIsSearchingPickup(false);
    }
  }, [suggestMinLen]);

  const runDropoffSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < suggestMinLen) {
      setDropoffSuggestions([]);
      return;
    }
    setIsSearchingDropoff(true);
    try {
      const rows = await searchAddressesNg(trimmed);
      setDropoffSuggestions(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setDropoffSuggestions([]);
    } finally {
      setIsSearchingDropoff(false);
    }
  }, [suggestMinLen]);

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

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!pickupAddress.trim() || !dropoffAddress.trim()) {
        toast.error("Pickup and dropoff are required.");
        return;
      }
      if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
        toast.error("Select pickup and dropoff from suggestions or use GPS so we can locate you accurately");
        return;
      }
      if (!contactPhone.trim()) {
        toast.error("Contact phone is required.");
        return;
      }
      pushRecentRideLocation(pickupAddress);
      pushRecentRideLocation(dropoffAddress);
      setRecentLocations(readRecentRideLocations());
      setShowConfirmSheet(true);
    },
    [contactPhone, dropoffAddress, dropoffLat, dropoffLng, pickupAddress, pickupLat, pickupLng],
  );

  const openExpandedMap = useCallback(
    (field: "pickup" | "dropoff") => {
      setActiveField(field);
      setDraftPickup({ lat: pickupLat, lng: pickupLng });
      setDraftDropoff({ lat: dropoffLat, lng: dropoffLng });
      setMapSessionId((prev) => prev + 1);
      setIsMapExpanded(true);
    },
    [pickupLat, pickupLng, dropoffLat, dropoffLng],
  );

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
  const canContinue = Boolean(pickupLocation && dropoffLocation && contactPhone.trim());

  const confirmRideBooking = useCallback(async () => {
    if (!authUser?.id) {
      toast.error("Please sign in to book a ride.");
      navigate(`/login?next=${encodeURIComponent("/book")}`);
      return;
    }
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      toast.error("Select pickup and dropoff from suggestions or use GPS.");
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

    setBookingSubmitting(true);
    try {
      const result = await createStandaloneRideBooking(supabase, {
        userId: authUser.id,
        pickup: { address: pickupAddress, lat: pickupLat, lng: pickupLng },
        dropoff: { address: dropoffAddress, lat: dropoffLat, lng: dropoffLng },
        contactPhone: contactPhone.trim(),
        vehicleTier,
        estimatedFareNgn,
        distanceKm,
        note: rideNote.trim() || null,
        source: "book_ride",
      });
      if ("error" in result) {
        const msg = result.error.message || "";
        if (
          msg.includes("estimated_fare_ngn") ||
          msg.includes("vehicle_tier") ||
          msg.includes("distance_km") ||
          msg.includes("vehicle_type") ||
          msg.includes("schema cache")
        ) {
          toast.error("Database needs the latest ride booking migration. Run Supabase migrations, then retry.");
        } else {
          toast.error(msg || "Could not save booking.");
        }
        return;
      }
      setShowConfirmSheet(false);
      toast.success("Ride request submitted.", { description: "We’ll match you with a rider." });
      navigate(`/bookings/${encodeURIComponent(result.id)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save booking.");
    } finally {
      setBookingSubmitting(false);
    }
  }, [
    authUser?.id,
    contactPhone,
    distanceKm,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    estimatedFareNgn,
    navigate,
    pickupAddress,
    pickupLat,
    pickupLng,
    rideNote,
    vehicleTier,
  ]);

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
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-5 text-white md:px-6">
          <h1 className="text-xl font-bold tracking-tight">Book a ride</h1>
          <p className="mt-1 text-sm font-medium text-emerald-50">Choose tier and route — fares shown in Nigerian Naira (₦).</p>
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
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
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
            <Suspense fallback={<div className="h-[340px] w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
              <DeliveryTrackingMapPreview
                pickupLocation={pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null}
                dropoffLocation={dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null}
                className="h-[340px] w-full rounded-xl shadow-sm"
                enableDemoRiderMovement={false}
              />
            </Suspense>
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow">
              {distanceKm == null ? "Set route points" : `${distanceKm.toFixed(2)} km route`}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedRide.label}</p>
                    <p className="text-xs text-gray-500">{selectedRide.etaLabel} away</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-700">{estimatedFareNgn == null ? "—" : formatNgn(estimatedFareNgn)}</p>
                    <p className="text-[11px] font-semibold text-gray-500">Cash</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Vehicle tier</label>
            <div className="space-y-3">
              {VEHICLE_TIER_OPTIONS.map((ride) => (
                <MemoRideOptionCard
                  key={ride.id}
                  ride={ride}
                  distanceKm={distanceKm}
                  selected={vehicleTier === ride.id}
                  onSelect={setVehicleTier}
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
              <span className="font-semibold text-gray-800">Estimated fare:</span>{" "}
              {estimatedFareNgn == null ? "—" : formatNgn(estimatedFareNgn)}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-100">Contact phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+234…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-100">Notes (optional)</label>
            <textarea
              value={rideNote}
              onChange={(e) => setRideNote(e.target.value)}
              rows={2}
              placeholder="Landmark, gate code…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
            />
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
                <p className="text-xs text-gray-500">Pay your rider after the trip</p>
              </div>
              <p className="text-xs font-semibold text-gray-500">Default</p>
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
              ref={continueBtnRef}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-base font-extrabold text-white hover:from-emerald-700 hover:to-emerald-600 disabled:pointer-events-none disabled:opacity-50"
            >
              {`Book ${selectedRide.label}`}
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
            <div className="relative min-h-[400px] flex-1 w-full overflow-hidden p-0">
              <div className="relative h-full w-full">
                <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
                  <DeliveryTrackingMapEditor
                    key={`map-editor-${mapSessionId}`}
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

      {showConfirmSheet && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={() => setShowConfirmSheet(false)}>
          <div ref={sheetRef} tabIndex={-1} className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
            <h3 className="mb-2 text-base font-semibold">Confirm your ride</h3>
            <p className="mb-2 text-sm text-gray-600">
              {selectedRide.label} · {estimatedFareNgn == null ? "—" : formatNgn(estimatedFareNgn)}
            </p>
            <p className="mb-3 text-xs text-gray-500 line-clamp-2">{pickupAddress}</p>
            <p className="mb-4 text-xs text-gray-500 line-clamp-2">{dropoffAddress}</p>
            <button
              ref={confirmBtnRef}
              type="button"
              disabled={bookingSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-white disabled:opacity-60"
              onClick={() => void confirmRideBooking()}
            >
              {bookingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {bookingSubmitting ? "Saving…" : "Confirm & request rider"}
            </button>
            <button type="button" className="mt-2 w-full text-gray-500" onClick={() => setShowConfirmSheet(false)} disabled={bookingSubmitting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default memo(BookRide);
