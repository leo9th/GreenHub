import { memo, useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type LatLng = {
  lat: number;
  lng: number;
};

type RiderLatLng = LatLng & {
  bearing?: number;
  lastSeenAt?: string | null;
};

type DeliveryTrackingMapProps = {
  riderLocation?: RiderLatLng | null;
  userLocation?: LatLng | null;
  pickupLocation?: LatLng | null;
  dropoffLocation?: LatLng | null;
  className?: string;
  onArrival?: () => void;
  /** Parent owns lifecycle; map only emits these stages (no optional / no UI coupling). */
  onMockRiderAssigned?: (stage: "assigned" | "arriving") => void;
  /**
   * Fires at most once per threshold crossing (hysteresis on exit). Uses refs only — safe for setState in parent if throttled.
   * `arriving`: under 500 m to current leg target · `almost_there`: under 50 m.
   */
  onRiderLegProximity?: (stage: "arriving" | "almost_there") => void;
};

const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CENTER: [number, number] = [8.6753, 9.082];
const RIDER_ANIMATION_MS = 1000;
const GPS_JITTER_THRESHOLD_METERS = 4.5;
const STALE_RIDER_THRESHOLD_MS = 10_000;
/** Mock “assigned” rider moves from a nearby point toward pickup (preview / no live GPS). */
const MOCK_PICKUP_APPROACH_MS = 6500;
/** Proximity stages (meters) — callbacks fire on edge cross only, not every frame. */
const PROX_ARRIVING_ENTER_M = 500;
const PROX_ARRIVING_EXIT_M = 560;
const PROX_ALMOST_ENTER_M = 50;
const PROX_ALMOST_EXIT_M = 75;
/** Debounce camera fits so bursts of GPS updates settle before moving the camera (reduces jitter). */
const CAMERA_DEBOUNCE_MS = 160;
const CAMERA_PADDING_BASE = 72;
const CAMERA_PADDING_FAR = 104;
const CAMERA_MAX_ZOOM_FAR = 14.25;
const CAMERA_MAX_ZOOM_MID = 16.25;
const CAMERA_MAX_ZOOM_NEAR = 17.75;
const CAMERA_MAX_ZOOM_CLOSE = 18.35;
const CAMERA_DURATION_MS = 920;
const RIDER_BEARING_SMOOTH_ALPHA = 0.2;
const ROUTE_LINE_COLOR = "#059669";
const ROUTE_LINE_WIDTH = 5.5;
const CAMERA_EASE_ID = "gh-delivery-tracking-camera";
const RIDER_TELEPORT_RESET_METERS = 130;

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function distanceMeters(from: LatLng, to: LatLng) {
  const radiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * radiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(from: LatLng, to: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function normalizeBearing(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

/** Shortest signed difference from `from` to `to` in degrees (−180 … 180). */
function shortestAngleDeltaDeg(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function lerpAngleDeg(from: number, to: number, alpha: number): number {
  return normalizeBearing(from + shortestAngleDeltaDeg(from, to) * alpha);
}

function cameraEasing(t: number): number {
  return 1 - Math.pow(1 - t, 2.35);
}

function dynamicCameraCaps(
  rider: LatLng | null,
  drop: LatLng | null,
  pickup: LatLng | null,
): { maxZoom: number; padding: number } {
  const a = rider ?? pickup;
  const b = drop ?? pickup;
  if (!a || !b) {
    return { maxZoom: CAMERA_MAX_ZOOM_MID, padding: CAMERA_PADDING_BASE };
  }
  const span = distanceMeters(a, b);
  if (span < 220) {
    return { maxZoom: CAMERA_MAX_ZOOM_CLOSE, padding: CAMERA_PADDING_BASE - 8 };
  }
  if (span < 650) {
    return { maxZoom: CAMERA_MAX_ZOOM_NEAR, padding: CAMERA_PADDING_BASE };
  }
  if (span < 4500) {
    return { maxZoom: CAMERA_MAX_ZOOM_MID, padding: CAMERA_PADDING_BASE + 12 };
  }
  return { maxZoom: CAMERA_MAX_ZOOM_FAR, padding: CAMERA_PADDING_FAR };
}

function computeRiderStale(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const lastSeenTs = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenTs)) return false;
  return Date.now() - lastSeenTs > STALE_RIDER_THRESHOLD_MS;
}

type ProximityBits = { near500: boolean; near50: boolean };

function applyProximityTransitions(
  distMeters: number,
  bits: ProximityBits,
  onLeg: ((stage: "arriving" | "almost_there") => void) | undefined,
): ProximityBits {
  const next = { ...bits };
  if (distMeters <= PROX_ALMOST_ENTER_M) {
    if (!bits.near50) {
      if (!bits.near500) {
        onLeg?.("arriving");
      }
      onLeg?.("almost_there");
      next.near50 = true;
      next.near500 = true;
    }
  } else if (distMeters <= PROX_ARRIVING_ENTER_M) {
    if (!bits.near500) {
      onLeg?.("arriving");
      next.near500 = true;
    }
  } else if (distMeters >= PROX_ALMOST_EXIT_M) {
    next.near50 = false;
  }
  if (distMeters >= PROX_ARRIVING_EXIT_M) {
    next.near500 = false;
    next.near50 = false;
  }
  return next;
}

function isValidLocation(loc: unknown): loc is LatLng {
  if (loc == null || typeof loc !== "object") return false;
  const lng = (loc as { lng?: unknown }).lng;
  const lat = (loc as { lat?: unknown }).lat;
  if (lng === undefined || lat === undefined) return false;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * normalizeLocation
 *
 * Central gate for all map coordinates.
 *
 * - Accepts unknown input and returns a safe { lng, lat } or null
 * - Uses isValidLocation to reject null/invalid/NaN/out-of-bounds values
 * - Ensures all downstream code (route, fitBounds, markers, animation)
 *   never reads `.lng` / `.lat` from undefined
 *
 * IMPORTANT:
 * Always call normalizeLocation(...) before using any location in map logic.
 * Do not access location.lng/lat directly from props or state.
 */
function normalizeLocation(loc: unknown): LatLng | null {
  if (!isValidLocation(loc)) return null;
  return {
    lng: Number((loc as LatLng).lng),
    lat: Number((loc as LatLng).lat),
  };
}

function createMarkerElement(type: "rider" | "pickup" | "dropoff") {
  const wrapper = document.createElement("div");
  wrapper.className = "gh-maplibre-marker";

  if (type === "rider") {
    wrapper.innerHTML = `
      <div data-rider-body="true" style="
        position: relative;
        width: 34px;
        height: 34px;
        transform-origin: 50% 50%;
        transition: none;
        will-change: transform;
        z-index: 40;
      ">
        <span style="
          position: absolute;
          inset: 0;
          display: block;
          border-radius: 9999px;
          background: rgba(37, 99, 235, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.7);
        "></span>
        <span style="
          position: absolute;
          inset: 5px;
          display: block;
          border-radius: 9999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.45);
        "></span>
        <span style="
          position: absolute;
          left: 50%;
          top: 1px;
          width: 0;
          height: 0;
          transform: translateX(-50%);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 10px solid #1d4ed8;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.22));
        "></span>
      </div>
    `;
    return wrapper;
  }

  const dot = document.createElement("div");
  dot.className = "flex h-5 w-5 items-center justify-center border-2 border-white text-[9px] font-black leading-none text-white";
  dot.style.borderRadius = type === "pickup" ? "9999px" : "0.4rem";
  dot.style.background = type === "pickup" ? "#16a34a" : "#111827";
  dot.style.boxShadow = type === "pickup" ? "0 6px 14px rgba(22,163,74,0.4)" : "0 6px 14px rgba(0,0,0,0.42)";
  dot.textContent = type === "pickup" ? "P" : "D";

  wrapper.appendChild(dot);
  return wrapper;
}

function createUserLocationElement() {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "26px";
  wrapper.style.height = "26px";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "30";

  const ring = document.createElement("span");
  ring.style.position = "absolute";
  ring.style.width = "24px";
  ring.style.height = "24px";
  ring.style.borderRadius = "9999px";
  ring.style.background = "rgba(37, 99, 235, 0.2)";
  ring.style.border = "1px solid rgba(37, 99, 235, 0.45)";

  const dot = document.createElement("span");
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius = "9999px";
  dot.style.border = "2px solid #ffffff";
  dot.style.background = "#2563eb";
  dot.style.boxShadow = "0 2px 8px rgba(37,99,235,0.42)";

  wrapper.appendChild(ring);
  wrapper.appendChild(dot);

  ring.animate(
    [
      { transform: "scale(0.9)", opacity: 0.65 },
      { transform: "scale(1.65)", opacity: 0.05 },
    ],
    { duration: 1500, easing: "ease-out", iterations: Number.POSITIVE_INFINITY },
  );

  return wrapper;
}

function routeFeature(pickupLocation?: LatLng | null, dropoffLocation?: LatLng | null): GeoJSON.Feature<GeoJSON.LineString> {
  const p = normalizeLocation(pickupLocation);
  const d = normalizeLocation(dropoffLocation);
  if (!p || !d) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [] },
    };
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [p.lng, p.lat],
        [d.lng, d.lat],
      ],
    },
  };
}

type BearingSmoothRef = { current: number | null };

/** Shortest-path bearing smoothing — call from RAF / animation frames only. */
function applySmoothedRiderRotation(
  marker: maplibregl.Marker | null,
  targetBearingDeg: number,
  smoothRef: BearingSmoothRef,
  alpha = RIDER_BEARING_SMOOTH_ALPHA,
) {
  const body = marker?.getElement().querySelector<HTMLElement>("[data-rider-body='true']");
  if (!body) return;
  const tgt = normalizeBearing(targetBearingDeg);
  if (smoothRef.current == null) smoothRef.current = tgt;
  else smoothRef.current = lerpAngleDeg(smoothRef.current, tgt, alpha);
  body.style.transition = "none";
  body.style.willChange = "transform";
  body.style.transform = `rotate(${smoothRef.current}deg)`;
}

function setRiderMarkerStaleState(marker: maplibregl.Marker | null, isStale: boolean) {
  const root = marker?.getElement();
  if (!root) return;
  root.style.opacity = isStale ? "0.48" : "1";
}

function DeliveryTrackingMap({
  riderLocation,
  userLocation,
  pickupLocation,
  dropoffLocation,
  className = "h-72 w-full rounded-xl",
  onArrival,
  onMockRiderAssigned,
  onRiderLegProximity,
}: DeliveryTrackingMapProps) {
  const onArrivalRef = useRef(onArrival);
  onArrivalRef.current = onArrival;
  const onMockRiderAssignedRef = useRef(onMockRiderAssigned);
  useEffect(() => {
    onMockRiderAssignedRef.current = onMockRiderAssigned;
  }, [onMockRiderAssigned]);
  const onRiderLegProximityRef = useRef(onRiderLegProximity);
  useEffect(() => {
    onRiderLegProximityRef.current = onRiderLegProximity;
  }, [onRiderLegProximity]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const routeDemoRiderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeDemoAnimationRef = useRef<number | null>(null);
  const animationSequenceRef = useRef(0);
  const isMapLoadedRef = useRef(false);
  const mapInitInProgressRef = useRef(false);
  const activeMockRiderRef = useRef<maplibregl.Marker | null>(null);
  const mockPickupApproachAnimationRef = useRef<number | null>(null);
  const mockPickupApproachSeqRef = useRef(0);
  const mockPickupApproachDoneRef = useRef(true);
  const routeDemoApproachWaitTimerRef = useRef<number | null>(null);
  const previousRiderLocationRef = useRef<RiderLatLng | null>(null);
  const lastCameraSignatureRef = useRef<string>("");
  const cameraDebounceTimerRef = useRef<number | null>(null);
  const riderBearingSmoothRef = useRef<number | null>(null);
  const mockPickupBearingSmoothRef = useRef<number | null>(null);
  const lastRouteCoordsJsonRef = useRef<string>("");
  const liveProximityRef = useRef<ProximityBits>({ near500: false, near50: false });
  const routeDemoProximityRef = useRef<ProximityBits>({ near500: false, near50: false });
  const pickupApproachProximityRef = useRef<ProximityBits>({ near500: false, near50: false });
  const mockPickupArrivingNotifiedRef = useRef(false);

  const [mapReadyTick, setMapReadyTick] = useState(0);

  const pickupLocationRef = useRef(pickupLocation);
  const dropoffLocationRef = useRef(dropoffLocation);
  const riderLocationRef = useRef(riderLocation);
  const userLocationRef = useRef(userLocation);
  pickupLocationRef.current = pickupLocation;
  dropoffLocationRef.current = dropoffLocation;
  riderLocationRef.current = riderLocation;
  userLocationRef.current = userLocation;

  const runCameraFitNow = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const bounds = new maplibregl.LngLatBounds();
    let extended = 0;

    const extendIf = (lng: number, lat: number) => {
      bounds.extend([lng, lat]);
      extended += 1;
    };

    try {
      if (riderMarkerRef.current?.getElement().parentElement) {
        const ll = riderMarkerRef.current.getLngLat();
        extendIf(ll.lng, ll.lat);
      }
      if (activeMockRiderRef.current) {
        const ll = activeMockRiderRef.current.getLngLat();
        extendIf(ll.lng, ll.lat);
      }
      if (routeDemoRiderMarkerRef.current) {
        const ll = routeDemoRiderMarkerRef.current.getLngLat();
        extendIf(ll.lng, ll.lat);
      }

      const p = normalizeLocation(pickupLocationRef.current);
      const d = normalizeLocation(dropoffLocationRef.current);
      if (p) extendIf(p.lng, p.lat);
      if (d) extendIf(d.lng, d.lat);

      if (extended < 2) return;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      let riderLL: LatLng | null = null;
      if (riderMarkerRef.current?.getElement().parentElement) {
        const ll = riderMarkerRef.current.getLngLat();
        riderLL = { lng: ll.lng, lat: ll.lat };
      } else if (activeMockRiderRef.current) {
        const ll = activeMockRiderRef.current.getLngLat();
        riderLL = { lng: ll.lng, lat: ll.lat };
      } else if (routeDemoRiderMarkerRef.current) {
        const ll = routeDemoRiderMarkerRef.current.getLngLat();
        riderLL = { lng: ll.lng, lat: ll.lat };
      }

      const { maxZoom, padding } = dynamicCameraCaps(riderLL, d, p);

      const sig = `${sw.lng.toFixed(4)},${sw.lat.toFixed(4)}|${ne.lng.toFixed(4)},${ne.lat.toFixed(4)}|${maxZoom.toFixed(2)}|${padding}`;
      if (sig === lastCameraSignatureRef.current) return;
      lastCameraSignatureRef.current = sig;

      if (Math.abs(sw.lng - ne.lng) < 1e-8 && Math.abs(sw.lat - ne.lat) < 1e-8) {
        map.easeTo({
          center: [sw.lng, sw.lat],
          zoom: Math.min(Math.max(map.getZoom(), 14), maxZoom),
          duration: CAMERA_DURATION_MS,
          easing: cameraEasing,
          essential: false,
          easeId: CAMERA_EASE_ID,
        });
        return;
      }

      map.fitBounds(bounds, {
        padding,
        duration: CAMERA_DURATION_MS,
        maxZoom,
        linear: true,
        easing: cameraEasing,
        essential: false,
        easeId: CAMERA_EASE_ID,
      });
    } catch {
      /* ignore invalid bounds */
    }
  }, []);

  const scheduleDebouncedCameraFit = useCallback(() => {
    if (cameraDebounceTimerRef.current != null) {
      window.clearTimeout(cameraDebounceTimerRef.current);
    }
    cameraDebounceTimerRef.current = window.setTimeout(() => {
      cameraDebounceTimerRef.current = null;
      runCameraFitNow();
    }, CAMERA_DEBOUNCE_MS);
  }, [runCameraFitNow]);

  const safeSetMarker = useCallback((marker: maplibregl.Marker, loc: unknown): boolean => {
    if (!mapRef.current || !isMapLoadedRef.current) return false;
    if (!loc || typeof loc !== "object") return false;
    const n = normalizeLocation(loc);
    if (!n) {
      if (import.meta.env.DEV) console.warn("Invalid location blocked", loc);
      return false;
    }
    marker.setLngLat([n.lng, n.lat]);
    return true;
  }, []);

  const safeAddMarker = useCallback((marker: maplibregl.Marker, loc: unknown): boolean => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return false;
    if (!loc || typeof loc !== "object") return false;
    const n = normalizeLocation(loc);
    if (!n) {
      if (import.meta.env.DEV) console.warn("Invalid location blocked", loc);
      return false;
    }
    marker.setLngLat([n.lng, n.lat]).addTo(map);
    return true;
  }, []);

  const setMarkerPosition = useCallback((marker: maplibregl.Marker | null, location?: LatLng | null) => {
    if (!marker) return;
    safeSetMarker(marker, location);
  }, [safeSetMarker]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mapInitInProgressRef.current) return;
    mapInitInProgressRef.current = true;
    isMapLoadedRef.current = false;

    const firstLocation = riderLocation ?? pickupLocation ?? dropoffLocation;
    const centerNorm = normalizeLocation(firstLocation);
    const center: [number, number] = centerNorm ? [centerNorm.lng, centerNorm.lat] : DEFAULT_CENTER;
    const style = import.meta.env.VITE_MAPLIBRE_STYLE_URL || FALLBACK_STYLE_URL;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center,
      zoom: 13,
      attributionControl: true,
      dragRotate: false,
      pitchWithRotate: false,
    });

    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    pickupMarkerRef.current = new maplibregl.Marker({ element: createMarkerElement("pickup") });
    dropoffMarkerRef.current = new maplibregl.Marker({ element: createMarkerElement("dropoff") });
    riderMarkerRef.current = new maplibregl.Marker({ element: createMarkerElement("rider") });
    userMarkerRef.current = new maplibregl.Marker({ element: createUserLocationElement() });

    map.on("load", () => {
      isMapLoadedRef.current = true;
      setMapReadyTick((t) => t + 1);

      const pu = normalizeLocation(pickupLocationRef.current);
      if (pu && pickupMarkerRef.current) safeAddMarker(pickupMarkerRef.current, pu);

      const dropLoc = normalizeLocation(dropoffLocationRef.current);
      if (dropLoc && dropoffMarkerRef.current) safeAddMarker(dropoffMarkerRef.current, dropLoc);

      const riderLocInit = normalizeLocation(riderLocationRef.current);
      if (riderLocInit && riderMarkerRef.current) {
        if (safeAddMarker(riderMarkerRef.current, riderLocInit)) {
          riderBearingSmoothRef.current = null;
          applySmoothedRiderRotation(
            riderMarkerRef.current,
            riderLocationRef.current?.bearing ?? 0,
            riderBearingSmoothRef,
            1,
          );
          setRiderMarkerStaleState(riderMarkerRef.current, computeRiderStale(riderLocationRef.current?.lastSeenAt));
          previousRiderLocationRef.current = {
            lng: riderLocInit.lng,
            lat: riderLocInit.lat,
            bearing: riderLocationRef.current?.bearing,
            lastSeenAt: riderLocationRef.current?.lastSeenAt ?? null,
          };
        }
      }

      const uu = normalizeLocation(userLocationRef.current);
      if (uu && userMarkerRef.current) safeAddMarker(userMarkerRef.current, uu);

      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: routeFeature(pickupLocationRef.current, dropoffLocationRef.current),
        });
      }
      if (!map.getLayer("route-line")) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": ROUTE_LINE_COLOR,
            "line-width": ROUTE_LINE_WIDTH,
            "line-opacity": 0.94,
            "line-blur": 0.35,
          },
        });
      }

      const p = normalizeLocation(pickupLocationRef.current);
      const d = normalizeLocation(dropoffLocationRef.current);
      if (!p || !d) return;
      scheduleDebouncedCameraFit();
    });

    return () => {
      if (cameraDebounceTimerRef.current != null) {
        window.clearTimeout(cameraDebounceTimerRef.current);
        cameraDebounceTimerRef.current = null;
      }
      if (mockPickupApproachAnimationRef.current != null) {
        cancelAnimationFrame(mockPickupApproachAnimationRef.current);
        mockPickupApproachAnimationRef.current = null;
      }
      if (routeDemoApproachWaitTimerRef.current != null) {
        window.clearTimeout(routeDemoApproachWaitTimerRef.current);
        routeDemoApproachWaitTimerRef.current = null;
      }
      activeMockRiderRef.current?.remove();
      activeMockRiderRef.current = null;
      mockPickupApproachDoneRef.current = true;
      mapInitInProgressRef.current = false;
      isMapLoadedRef.current = false;
      lastCameraSignatureRef.current = "";
      lastRouteCoordsJsonRef.current = "";
      riderBearingSmoothRef.current = null;
      mockPickupBearingSmoothRef.current = null;
      animationSequenceRef.current += 1;
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (routeDemoAnimationRef.current != null) {
        window.cancelAnimationFrame(routeDemoAnimationRef.current);
        routeDemoAnimationRef.current = null;
      }
      routeDemoRiderMarkerRef.current?.remove();
      routeDemoRiderMarkerRef.current = null;
      previousRiderLocationRef.current = null;
      riderMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // MapLibre must initialize once; marker positions are updated in separate effects.
  }, [safeAddMarker, scheduleDebouncedCameraFit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickupMarkerRef.current || !isMapLoadedRef.current) return;
    const pu = normalizeLocation(pickupLocation);
    if (pu) {
      const pm = pickupMarkerRef.current;
      if (!pm.getElement().parentElement) safeAddMarker(pm, pu);
      else setMarkerPosition(pm, pu);
    } else {
      pickupMarkerRef.current.remove();
    }
  }, [pickupLocation, safeAddMarker, setMarkerPosition]);

  /** One mock rider “assigned” nearby, then animated toward pickup (no live `riderLocation`). */
  useEffect(() => {
    const cancelApproach = () => {
      if (mockPickupApproachAnimationRef.current != null) {
        cancelAnimationFrame(mockPickupApproachAnimationRef.current);
        mockPickupApproachAnimationRef.current = null;
      }
    };

    const removeActiveMock = () => {
      activeMockRiderRef.current?.remove();
      activeMockRiderRef.current = null;
    };

    const p = normalizeLocation(pickupLocation);
    const liveRider = normalizeLocation(riderLocation);

    if (!p || !mapRef.current || !isMapLoadedRef.current || liveRider) {
      mockPickupApproachSeqRef.current += 1;
      cancelApproach();
      removeActiveMock();
      mockPickupApproachDoneRef.current = true;
      return;
    }

    mockPickupApproachSeqRef.current += 1;
    const seq = mockPickupApproachSeqRef.current;
    cancelApproach();
    removeActiveMock();
    pickupApproachProximityRef.current = { near500: false, near50: false };
    mockPickupArrivingNotifiedRef.current = false;
    mockPickupBearingSmoothRef.current = null;

    const map = mapRef.current;
    const startNorm = normalizeLocation({ lng: p.lng + 0.002, lat: p.lat + 0.002 });
    if (!startNorm) {
      mockPickupApproachDoneRef.current = true;
      return;
    }

    const marker = new maplibregl.Marker({ element: createMarkerElement("rider") });
    if (!safeAddMarker(marker, startNorm)) {
      mockPickupApproachDoneRef.current = true;
      return;
    }
    activeMockRiderRef.current = marker;
    mockPickupApproachDoneRef.current = false;
    onMockRiderAssignedRef.current?.("assigned");

    const startedAt = performance.now();
    let prevFrame: LatLng = startNorm;

    const animate = (now: number) => {
      if (seq !== mockPickupApproachSeqRef.current || !activeMockRiderRef.current || mapRef.current !== map) {
        return;
      }
      const rawT = Math.min(1, (now - startedAt) / MOCK_PICKUP_APPROACH_MS);
      const eased = easeInOutCubic(rawT);
      const lng = lerp(startNorm.lng, p.lng, eased);
      const lat = lerp(startNorm.lat, p.lat, eased);
      const step = normalizeLocation({ lng, lat });
      if (!step || !safeSetMarker(activeMockRiderRef.current, step)) {
        mockPickupApproachDoneRef.current = true;
        return;
      }

      const bearing = computeBearing(prevFrame, step);
      applySmoothedRiderRotation(activeMockRiderRef.current, bearing, mockPickupBearingSmoothRef);
      prevFrame = step;

      const distPick = distanceMeters(step, p);
      if (distPick < PROX_ARRIVING_ENTER_M && !mockPickupArrivingNotifiedRef.current) {
        mockPickupArrivingNotifiedRef.current = true;
        onMockRiderAssignedRef.current?.("arriving");
      }
      pickupApproachProximityRef.current = applyProximityTransitions(
        distPick,
        pickupApproachProximityRef.current,
        (stage) => {
          if (stage === "almost_there") onRiderLegProximityRef.current?.(stage);
        },
      );

      scheduleDebouncedCameraFit();

      if (rawT < 1) {
        mockPickupApproachAnimationRef.current = requestAnimationFrame(animate);
      } else {
        mockPickupApproachAnimationRef.current = null;
        mockPickupApproachDoneRef.current = true;
      }
    };

    mockPickupApproachAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      mockPickupApproachSeqRef.current += 1;
      cancelApproach();
      removeActiveMock();
      mockPickupApproachDoneRef.current = true;
    };
  }, [pickupLocation, riderLocation, mapReadyTick, safeAddMarker, safeSetMarker, scheduleDebouncedCameraFit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dropoffMarkerRef.current || !isMapLoadedRef.current) return;
    const dr = normalizeLocation(dropoffLocation);
    if (dr) {
      const dm = dropoffMarkerRef.current;
      if (!dm.getElement().parentElement) safeAddMarker(dm, dr);
      else setMarkerPosition(dm, dr);
    } else {
      dropoffMarkerRef.current.remove();
    }
  }, [dropoffLocation, safeAddMarker, setMarkerPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const source = map?.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // NOTE: p/d below are always normalized LatLng (never raw props)
    const p = normalizeLocation(pickupLocation);
    const d = normalizeLocation(dropoffLocation);
    const feature = routeFeature(pickupLocation, dropoffLocation);
    const coordKey = JSON.stringify(feature.geometry.coordinates);

    if (!p || !d) {
      if (coordKey !== lastRouteCoordsJsonRef.current) {
        lastRouteCoordsJsonRef.current = coordKey;
        source.setData(feature);
      }
      return;
    }

    if (coordKey === lastRouteCoordsJsonRef.current) {
      return;
    }
    lastRouteCoordsJsonRef.current = coordKey;
    source.setData(feature);
    scheduleDebouncedCameraFit();
  }, [pickupLocation, dropoffLocation, scheduleDebouncedCameraFit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userMarkerRef.current || !isMapLoadedRef.current) return;
    const u = normalizeLocation(userLocation);
    if (u) {
      const um = userMarkerRef.current;
      if (!um.getElement().parentElement) safeAddMarker(um, u);
      else setMarkerPosition(um, u);
    } else {
      userMarkerRef.current.remove();
    }
  }, [userLocation, safeAddMarker, setMarkerPosition]);

  useEffect(() => {
    const pickupMarker = pickupMarkerRef.current;
    const dropoffMarker = dropoffMarkerRef.current;
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (!pickupMarker || !dropoffMarker) return;

    const p = normalizeLocation(pickupLocation);
    const d = normalizeLocation(dropoffLocation);
    if (!p || !d) {
      pickupMarker.setOffset([0, 0]);
      dropoffMarker.setOffset([0, 0]);
      return;
    }

    const shouldOffset = distanceMeters(p, d) < 80;
    pickupMarker.setOffset(shouldOffset ? [-10, -10] : [0, 0]);
    dropoffMarker.setOffset(shouldOffset ? [10, 10] : [0, 0]);
  }, [pickupLocation, dropoffLocation]);

  /** UI-only: animate a rider icon along the straight pickup→dropoff segment (preview maps without live rider). */
  useEffect(() => {
    const cancelDemoAnimation = () => {
      if (routeDemoAnimationRef.current != null) {
        window.cancelAnimationFrame(routeDemoAnimationRef.current);
        routeDemoAnimationRef.current = null;
      }
    };

    const removeDemoMarker = () => {
      routeDemoRiderMarkerRef.current?.remove();
      routeDemoRiderMarkerRef.current = null;
    };

    // NOTE: Always use normalized locations (p/d), never raw props
    const p = normalizeLocation(pickupLocation);
    const d = normalizeLocation(dropoffLocation);
    if (!p || !d) {
      cancelDemoAnimation();
      removeDemoMarker();
      return;
    }

    if (normalizeLocation(riderLocation)) {
      cancelDemoAnimation();
      removeDemoMarker();
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const runDemo = () => {
      if (!isMapLoadedRef.current || mapRef.current !== map) return;

      cancelDemoAnimation();
      removeDemoMarker();

      routeDemoProximityRef.current = { near500: false, near50: false };

      const el = document.createElement("div");
      el.textContent = "🛵";
      el.style.fontSize = "20px";
      el.style.lineHeight = "1";
      el.style.pointerEvents = "none";
      el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
      el.style.transformOrigin = "50% 55%";

      const marker = new maplibregl.Marker({ element: el });
      if (!safeAddMarker(marker, p)) return;

      routeDemoRiderMarkerRef.current = marker;

      let start: number | null = null;
      const duration = 8000;
      let prevDemo: LatLng = { ...p };
      let demoBearingSmooth: number | null = null;

      const animate = (ts: number) => {
        const m = routeDemoRiderMarkerRef.current;
        if (!m || mapRef.current !== map) return;

        if (start === null) start = ts;
        const progress = Math.min((ts - start) / duration, 1);

        const lng = lerp(p.lng, d.lng, progress);
        const lat = lerp(p.lat, d.lat, progress);
        const step = normalizeLocation({ lng, lat });
        if (!step || !safeSetMarker(m, step)) return;

        const bearing = computeBearing(prevDemo, step);
        if (demoBearingSmooth == null) demoBearingSmooth = normalizeBearing(bearing);
        else demoBearingSmooth = lerpAngleDeg(demoBearingSmooth, bearing, 0.22);
        el.style.transition = "none";
        el.style.willChange = "transform";
        el.style.transform = `rotate(${demoBearingSmooth}deg)`;
        prevDemo = step;

        const distDrop = distanceMeters(step, d);
        routeDemoProximityRef.current = applyProximityTransitions(
          distDrop,
          routeDemoProximityRef.current,
          (stage) => onRiderLegProximityRef.current?.(stage),
        );

        scheduleDebouncedCameraFit();

        if (progress < 1) {
          routeDemoAnimationRef.current = window.requestAnimationFrame(animate);
        } else {
          routeDemoAnimationRef.current = null;
          onArrivalRef.current?.();
        }
      };

      routeDemoAnimationRef.current = window.requestAnimationFrame(animate);
    };

    const run = () => {
      if (routeDemoApproachWaitTimerRef.current != null) {
        window.clearTimeout(routeDemoApproachWaitTimerRef.current);
        routeDemoApproachWaitTimerRef.current = null;
      }

      const schedule = () => {
        if (!isMapLoadedRef.current || mapRef.current !== map) return;
        if (!mockPickupApproachDoneRef.current) {
          routeDemoApproachWaitTimerRef.current = window.setTimeout(schedule, 100);
          return;
        }
        runDemo();
      };

      schedule();
    };

    if (isMapLoadedRef.current) {
      run();
    } else {
      map.once("load", run);
    }

    return () => {
      map.off("load", run);
      if (routeDemoApproachWaitTimerRef.current != null) {
        window.clearTimeout(routeDemoApproachWaitTimerRef.current);
        routeDemoApproachWaitTimerRef.current = null;
      }
      cancelDemoAnimation();
      removeDemoMarker();
    };
  }, [pickupLocation, dropoffLocation, riderLocation, safeAddMarker, safeSetMarker, scheduleDebouncedCameraFit]);

  useEffect(() => {
    liveProximityRef.current = { near500: false, near50: false };
  }, [riderLocation, dropoffLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riderMarkerRef.current || !isMapLoadedRef.current) return;
    const curr = normalizeLocation(riderLocation);
    if (curr) {
      const marker = riderMarkerRef.current;
      if (!marker.getElement().parentElement) {
        if (!safeAddMarker(marker, curr)) return;
      }

      const previous = previousRiderLocationRef.current;
      const prevNorm = normalizeLocation(previous);

      if (!previous || !prevNorm) {
        if (!safeSetMarker(marker, curr)) return;
        riderBearingSmoothRef.current = null;
        applySmoothedRiderRotation(marker, riderLocation?.bearing ?? 0, riderBearingSmoothRef, 1);
        setRiderMarkerStaleState(marker, computeRiderStale(riderLocation?.lastSeenAt));
        previousRiderLocationRef.current = {
          lng: curr.lng,
          lat: curr.lat,
          bearing: riderLocation?.bearing,
          lastSeenAt: riderLocation?.lastSeenAt ?? null,
        };
        return;
      }

      const distance = distanceMeters(prevNorm, curr);
      if (distance < GPS_JITTER_THRESHOLD_METERS) {
        if (riderLocation?.bearing != null) {
          applySmoothedRiderRotation(marker, riderLocation.bearing, riderBearingSmoothRef, 0.32);
          previousRiderLocationRef.current = {
            ...prevNorm,
            bearing: riderLocation.bearing,
            lastSeenAt: previous.lastSeenAt ?? riderLocation?.lastSeenAt ?? null,
          };
        }
        setRiderMarkerStaleState(marker, computeRiderStale(riderLocation?.lastSeenAt));
        return;
      }

      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationSequenceRef.current += 1;
      const sequence = animationSequenceRef.current;

      if (distance > RIDER_TELEPORT_RESET_METERS) {
        riderBearingSmoothRef.current = null;
      }

      const startedAt = performance.now();

      const animate = (now: number) => {
        if (sequence !== animationSequenceRef.current || !riderMarkerRef.current || !isMapLoadedRef.current) {
          return;
        }
        const rawProgress = Math.min(1, (now - startedAt) / RIDER_ANIMATION_MS);
        const eased = easeInOutCubic(rawProgress);
        const lng = lerp(prevNorm.lng, curr.lng, eased);
        const lat = lerp(prevNorm.lat, curr.lat, eased);
        const frameLoc = normalizeLocation({ lng, lat });
        if (!frameLoc || !safeSetMarker(marker, frameLoc)) return;

        const bearing =
          riderLocationRef.current?.bearing != null
            ? riderLocationRef.current.bearing
            : computeBearing(prevNorm, frameLoc);
        applySmoothedRiderRotation(marker, bearing, riderBearingSmoothRef);
        setRiderMarkerStaleState(marker, computeRiderStale(riderLocationRef.current?.lastSeenAt));

        const drop = normalizeLocation(dropoffLocationRef.current);
        if (drop) {
          const distDrop = distanceMeters(frameLoc, drop);
          liveProximityRef.current = applyProximityTransitions(
            distDrop,
            liveProximityRef.current,
            (stage) => onRiderLegProximityRef.current?.(stage),
          );
        }

        scheduleDebouncedCameraFit();

        if (rawProgress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        const finalLoc = normalizeLocation(curr);
        if (!finalLoc || !safeSetMarker(marker, finalLoc)) return;
        applySmoothedRiderRotation(marker, bearing, riderBearingSmoothRef, 0.35);
        setRiderMarkerStaleState(marker, computeRiderStale(riderLocationRef.current?.lastSeenAt));
        previousRiderLocationRef.current = {
          lng: finalLoc.lng,
          lat: finalLoc.lat,
          bearing,
          lastSeenAt: riderLocation?.lastSeenAt ?? null,
        };
        animationFrameRef.current = null;
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    } else {
      animationSequenceRef.current += 1;
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      previousRiderLocationRef.current = null;
      riderBearingSmoothRef.current = null;
      riderMarkerRef.current.remove();
    }
  }, [riderLocation, safeAddMarker, safeSetMarker, scheduleDebouncedCameraFit]);

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <div ref={containerRef} className="h-full min-h-[260px] w-full" />
    </div>
  );
}

function latLngEqual(a: LatLng | null | undefined, b: LatLng | null | undefined, eps = 1e-6): boolean {
  if (a == null && b == null) return true;
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps;
}

function areDeliveryTrackingMapPropsEqual(prev: DeliveryTrackingMapProps, next: DeliveryTrackingMapProps): boolean {
  return (
    latLngEqual(prev.pickupLocation, next.pickupLocation) &&
    latLngEqual(prev.dropoffLocation, next.dropoffLocation) &&
    latLngEqual(prev.userLocation, next.userLocation) &&
    latLngEqual(prev.riderLocation, next.riderLocation) &&
    (prev.riderLocation?.bearing ?? null) === (next.riderLocation?.bearing ?? null) &&
    (prev.riderLocation?.lastSeenAt ?? null) === (next.riderLocation?.lastSeenAt ?? null) &&
    prev.className === next.className &&
    prev.onArrival === next.onArrival &&
    prev.onMockRiderAssigned === next.onMockRiderAssigned &&
    prev.onRiderLegProximity === next.onRiderLegProximity
  );
}

export default memo(DeliveryTrackingMap, areDeliveryTrackingMapPropsEqual);
