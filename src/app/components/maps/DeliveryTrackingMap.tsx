import { memo, useEffect, useMemo, useRef } from "react";
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
};

const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CENTER: [number, number] = [8.6753, 9.082];
const RIDER_ANIMATION_MS = 900;
const GPS_JITTER_THRESHOLD_METERS = 2;
const STALE_RIDER_THRESHOLD_MS = 10_000;

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

function isValidLocation(location?: LatLng | null): location is LatLng {
  return (
    Boolean(location) &&
    Number.isFinite(location?.lat) &&
    Number.isFinite(location?.lng) &&
    Math.abs(location!.lat) <= 90 &&
    Math.abs(location!.lng) <= 180
  );
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
        transition: transform 120ms linear;
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

function setMarkerPosition(marker: maplibregl.Marker | null, location?: LatLng | null) {
  if (!marker || !isValidLocation(location)) return;
  marker.setLngLat([location.lng, location.lat]);
}

function routeFeature(pickupLocation?: LatLng | null, dropoffLocation?: LatLng | null): GeoJSON.Feature<GeoJSON.LineString> {
  if (isValidLocation(pickupLocation) && isValidLocation(dropoffLocation)) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [pickupLocation.lng, pickupLocation.lat],
          [dropoffLocation.lng, dropoffLocation.lat],
        ],
      },
    };
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [] },
  };
}

function rotateRiderMarker(marker: maplibregl.Marker | null, bearing: number) {
  const body = marker?.getElement().querySelector<HTMLElement>("[data-rider-body='true']");
  if (!body) return;
  body.style.transform = `rotate(${normalizeBearing(bearing)}deg)`;
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
}: DeliveryTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const didFitBoundsRef = useRef(false);
  const previousRiderLocationRef = useRef<RiderLatLng | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationSequenceRef = useRef(0);
  const isMapLoadedRef = useRef(false);
  const mapInitInProgressRef = useRef(false);
  const isRiderStale = useMemo(() => {
    if (!riderLocation?.lastSeenAt) return false;
    const lastSeenTs = Date.parse(riderLocation.lastSeenAt);
    if (!Number.isFinite(lastSeenTs)) return false;
    return Date.now() - lastSeenTs > STALE_RIDER_THRESHOLD_MS;
  }, [riderLocation?.lastSeenAt]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mapInitInProgressRef.current) return;
    mapInitInProgressRef.current = true;
    isMapLoadedRef.current = false;

    const firstLocation = riderLocation ?? pickupLocation ?? dropoffLocation;
    const center: [number, number] = isValidLocation(firstLocation) ? [firstLocation.lng, firstLocation.lat] : DEFAULT_CENTER;
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

    if (isValidLocation(pickupLocation)) {
      pickupMarkerRef.current.setLngLat([pickupLocation.lng, pickupLocation.lat]).addTo(map);
    }
    if (isValidLocation(dropoffLocation)) {
      dropoffMarkerRef.current.setLngLat([dropoffLocation.lng, dropoffLocation.lat]).addTo(map);
    }
    if (isValidLocation(riderLocation)) {
      riderMarkerRef.current.setLngLat([riderLocation.lng, riderLocation.lat]).addTo(map);
      rotateRiderMarker(riderMarkerRef.current, riderLocation.bearing ?? 0);
      setRiderMarkerStaleState(riderMarkerRef.current, isRiderStale);
      previousRiderLocationRef.current = riderLocation;
    }
    if (isValidLocation(userLocation)) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    }

    map.on("load", () => {
      isMapLoadedRef.current = true;
      if (!map.getSource("delivery-route")) {
        map.addSource("delivery-route", {
          type: "geojson",
          data: routeFeature(pickupLocation, dropoffLocation),
        });
      }
      if (!map.getLayer("route-casing")) {
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "delivery-route",
          paint: {
            "line-color": "#0f172a",
            "line-width": 8,
            "line-opacity": 0.45,
            "line-blur": 0.5,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer("route-glow")) {
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "delivery-route",
          paint: {
            "line-color": "#22c55e",
            "line-width": 11,
            "line-opacity": 0.18,
            "line-blur": 4,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer("route-main")) {
        map.addLayer({
          id: "route-main",
          type: "line",
          source: "delivery-route",
          paint: {
            "line-color": "#16a34a",
            "line-width": 4,
            "line-opacity": 0.98,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }

      if (didFitBoundsRef.current || !isValidLocation(pickupLocation) || !isValidLocation(dropoffLocation)) return;
      didFitBoundsRef.current = true;
      const bounds = new maplibregl.LngLatBounds()
        .extend([pickupLocation.lng, pickupLocation.lat])
        .extend([dropoffLocation.lng, dropoffLocation.lat]);
      if (isValidLocation(riderLocation)) {
        bounds.extend([riderLocation.lng, riderLocation.lat]);
      }
      map.fitBounds(bounds, {
        padding: { top: 48, right: 32, bottom: 48, left: 32 },
        maxZoom: 15,
        duration: 0,
      });
    });

    return () => {
      mapInitInProgressRef.current = false;
      isMapLoadedRef.current = false;
      animationSequenceRef.current += 1;
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      previousRiderLocationRef.current = null;
      riderMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // MapLibre must initialize once; marker positions are updated in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickupMarkerRef.current || !isMapLoadedRef.current) return;
    if (isValidLocation(pickupLocation)) {
      if (!pickupMarkerRef.current.getElement().parentElement) pickupMarkerRef.current.addTo(map);
      setMarkerPosition(pickupMarkerRef.current, pickupLocation);
    } else {
      pickupMarkerRef.current.remove();
    }
  }, [pickupLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dropoffMarkerRef.current || !isMapLoadedRef.current) return;
    if (isValidLocation(dropoffLocation)) {
      if (!dropoffMarkerRef.current.getElement().parentElement) dropoffMarkerRef.current.addTo(map);
      setMarkerPosition(dropoffMarkerRef.current, dropoffLocation);
    } else {
      dropoffMarkerRef.current.remove();
    }
  }, [dropoffLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const source = map?.getSource("delivery-route") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(routeFeature(pickupLocation, dropoffLocation));
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userMarkerRef.current || !isMapLoadedRef.current) return;
    if (isValidLocation(userLocation)) {
      if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(map);
      setMarkerPosition(userMarkerRef.current, userLocation);
    } else {
      userMarkerRef.current.remove();
    }
  }, [userLocation]);

  useEffect(() => {
    const pickupMarker = pickupMarkerRef.current;
    const dropoffMarker = dropoffMarkerRef.current;
    if (!isMapLoadedRef.current) return;
    if (!pickupMarker || !dropoffMarker) return;

    if (isValidLocation(pickupLocation) && isValidLocation(dropoffLocation)) {
      const shouldOffset = distanceMeters(pickupLocation, dropoffLocation) < 80;
      pickupMarker.setOffset(shouldOffset ? [-10, -10] : [0, 0]);
      dropoffMarker.setOffset(shouldOffset ? [10, 10] : [0, 0]);
    } else {
      pickupMarker.setOffset([0, 0]);
      dropoffMarker.setOffset([0, 0]);
    }
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riderMarkerRef.current || !isMapLoadedRef.current) return;
    if (isValidLocation(riderLocation)) {
      if (!riderMarkerRef.current.getElement().parentElement) riderMarkerRef.current.addTo(map);
      const marker = riderMarkerRef.current;
      const previous = previousRiderLocationRef.current;

      if (!previous) {
        setMarkerPosition(marker, riderLocation);
        rotateRiderMarker(marker, riderLocation.bearing ?? 0);
        setRiderMarkerStaleState(marker, isRiderStale);
        previousRiderLocationRef.current = riderLocation;
        return;
      }

      const distance = distanceMeters(previous, riderLocation);
      if (distance < GPS_JITTER_THRESHOLD_METERS) {
        if (riderLocation.bearing != null) {
          rotateRiderMarker(marker, riderLocation.bearing);
          previousRiderLocationRef.current = { ...previous, bearing: riderLocation.bearing };
        }
        setRiderMarkerStaleState(marker, isRiderStale);
        return;
      }

      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationSequenceRef.current += 1;
      const sequence = animationSequenceRef.current;

      const targetBearing = riderLocation.bearing ?? computeBearing(previous, riderLocation);
      const startedAt = performance.now();

      const animate = (now: number) => {
        if (sequence !== animationSequenceRef.current || !riderMarkerRef.current || !isMapLoadedRef.current) {
          return;
        }
        const rawProgress = Math.min(1, (now - startedAt) / RIDER_ANIMATION_MS);
        const eased = easeInOutCubic(rawProgress);
        marker.setLngLat([lerp(previous.lng, riderLocation.lng, eased), lerp(previous.lat, riderLocation.lat, eased)]);
        rotateRiderMarker(marker, targetBearing);
        setRiderMarkerStaleState(marker, isRiderStale);

        if (rawProgress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        marker.setLngLat([riderLocation.lng, riderLocation.lat]);
        rotateRiderMarker(marker, targetBearing);
        setRiderMarkerStaleState(marker, isRiderStale);
        previousRiderLocationRef.current = { ...riderLocation, bearing: targetBearing };
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
      riderMarkerRef.current.remove();
    }
  }, [riderLocation, isRiderStale]);

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <div ref={containerRef} className="h-full min-h-[260px] w-full" />
      <div className="pointer-events-none absolute left-2 top-2 z-20">
        <div className="rounded-lg border border-white/75 bg-white/85 px-2 py-1.5 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="uppercase tracking-wide text-[9px] text-emerald-700">Live Tracking</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 ring-1 ring-white" />
              Rider
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-black text-white ring-1 ring-white">
                P
              </span>
              Pickup
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-[3px] bg-gray-900 text-[8px] font-black text-white ring-1 ring-white">
                D
              </span>
              Dropoff
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-white" />
              User
            </span>
          </div>
          {isRiderStale ? (
            <div className="mt-1 text-[9px] font-medium text-amber-700">Updating location...</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(DeliveryTrackingMap);
