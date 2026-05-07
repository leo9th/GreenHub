import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import {
  VEHICLE_TIER_OPTIONS,
  createStandaloneRideBooking,
  estimateRideFareNgn,
  haversineKm,
  pushRecentRideLocation,
  readRecentRideLocations,
  reverseGeocode,
  searchAddressesNg,
  suggestMinQueryLength,
  type RideVehicleTier,
} from "../../../../modules/rider";
import { deriveRideBookingUiPhase } from "./rideBookingPhase";
import { normRouteAddr, type RoutePointSource } from "./types";

export function useBookRideFlow(initialVehicleTier: RideVehicleTier) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

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
  const [vehicleTier, setVehicleTier] = useState<RideVehicleTier>(initialVehicleTier);
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

  const uiPhase = useMemo(
    () => deriveRideBookingUiPhase({ showConfirmSheet, isMapExpanded }),
    [showConfirmSheet, isMapExpanded],
  );

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

  const runPickupSearch = useCallback(
    async (query: string) => {
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
    },
    [suggestMinLen],
  );

  const runDropoffSearch = useCallback(
    async (query: string) => {
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
    },
    [suggestMinLen],
  );

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

  const handlePickupInputChange = useCallback((v: string) => {
    setPickupAddress(v);
    setActiveField("pickup");
    if (pickupLat != null && pickupLng != null && pickupAnchorText && normRouteAddr(v) !== normRouteAddr(pickupAnchorText)) {
      setPickupLat(null);
      setPickupLng(null);
      setPickupSource("none");
      setPickupAnchorText("");
    }
  }, [pickupAnchorText, pickupLat, pickupLng]);

  const handleDropoffInputChange = useCallback((v: string) => {
    setDropoffAddress(v);
    setActiveField("dropoff");
    if (dropoffLat != null && dropoffLng != null && dropoffAnchorText && normRouteAddr(v) !== normRouteAddr(dropoffAnchorText)) {
      setDropoffLat(null);
      setDropoffLng(null);
      setDropoffSource("none");
      setDropoffAnchorText("");
    }
  }, [dropoffAnchorText, dropoffLat, dropoffLng]);

  const swapRouteEndpoints = useCallback(() => {
    setPickupAddress(dropoffAddress);
    setDropoffAddress(pickupAddress);
    setPickupLat(dropoffLat);
    setPickupLng(dropoffLng);
    setDropoffLat(pickupLat);
    setDropoffLng(pickupLng);
    setPickupSource(dropoffSource);
    setDropoffSource(pickupSource);
    setPickupAnchorText(dropoffAnchorText);
    setDropoffAnchorText(pickupAnchorText);
  }, [
    dropoffAddress,
    dropoffAnchorText,
    dropoffLat,
    dropoffLng,
    dropoffSource,
    pickupAddress,
    pickupAnchorText,
    pickupLat,
    pickupLng,
    pickupSource,
  ]);

  type AddressSuggestion = Awaited<ReturnType<typeof searchAddressesNg>>[number];

  const selectPickupSuggestion = useCallback((s: AddressSuggestion) => {
    setPickupAddress(s.display_name);
    setPickupLat(s.lat);
    setPickupLng(s.lng);
    setPickupSource("suggestion");
    setPickupAnchorText(s.display_name);
    setPickupSuggestions([]);
  }, []);

  const selectDropoffSuggestion = useCallback((s: AddressSuggestion) => {
    setDropoffAddress(s.display_name);
    setDropoffLat(s.lat);
    setDropoffLng(s.lng);
    setDropoffSource("suggestion");
    setDropoffAnchorText(s.display_name);
    setDropoffSuggestions([]);
  }, []);

  const applyRecentLocationTap = useCallback(
    (loc: string) => {
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
    },
    [pickupAddress],
  );

  return {
    sheetRef,
    continueBtnRef,
    confirmBtnRef,
    mapModalContainerRef,
    uiPhase,
    suggestMinLen,
    isMapExpanded,
    setIsMapExpanded,
    mapSessionId,
    mapInteractionMode,
    setMapInteractionMode,
    activeField,
    setActiveField,
    pickupAddress,
    dropoffAddress,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    pickupSource,
    dropoffSource,
    vehicleTier,
    setVehicleTier,
    pickupSuggestions,
    dropoffSuggestions,
    isSearchingPickup,
    isSearchingDropoff,
    showConfirmSheet,
    setShowConfirmSheet,
    isResolvingAddress,
    draftPickup,
    draftDropoff,
    setDraftPickup,
    setDraftDropoff,
    contactPhone,
    setContactPhone,
    bookingSubmitting,
    rideNote,
    setRideNote,
    recentLocations,
    distanceKm,
    estimatedFareNgn,
    selectedRide,
    runPickupSearch,
    runDropoffSearch,
    useCurrentLocation,
    handleSubmit,
    openExpandedMap,
    applyDraftToActiveField,
    expandedPickupLat,
    expandedPickupLng,
    expandedDropoffLat,
    expandedDropoffLng,
    pickupLocation,
    dropoffLocation,
    canContinue,
    confirmRideBooking,
    handlePickupInputChange,
    handleDropoffInputChange,
    swapRouteEndpoints,
    selectPickupSuggestion,
    selectDropoffSuggestion,
    applyRecentLocationTap,
  };
}
