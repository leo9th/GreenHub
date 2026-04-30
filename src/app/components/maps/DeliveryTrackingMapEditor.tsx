import { memo, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type DeliveryTrackingMapEditorProps = {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  interactive?: boolean;
  interactionMode?: "fixedPin" | "markers";
  activeField?: "pickup" | "dropoff";
  showRoute?: boolean;
  followPosition?: boolean;
  onMapCenterChange?: (lat: number, lng: number) => void;
  onPickupChange?: (lat: number, lng: number) => void;
  onDropoffChange?: (lat: number, lng: number) => void;
  className?: string;
};

type LatLng = { lat: number; lng: number };

const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CENTER: [number, number] = [8.6753, 9.082];

function isValidLocation(location?: LatLng | null): location is LatLng {
  return (
    Boolean(location) &&
    Number.isFinite(location?.lat) &&
    Number.isFinite(location?.lng) &&
    Math.abs(location!.lat) <= 90 &&
    Math.abs(location!.lng) <= 180
  );
}

function toLngLat(lat?: number | null, lng?: number | null): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function createMarkerElement(type: "pickup" | "dropoff") {
  const wrapper = document.createElement("div");
  wrapper.className = "gh-maplibre-editor-marker";

  const dot = document.createElement("div");
  dot.className = "flex h-6 w-6 items-center justify-center border-2 border-white text-[10px] font-black leading-none text-white";
  dot.style.borderRadius = type === "pickup" ? "9999px" : "0.45rem";
  dot.style.background = type === "pickup" ? "#16a34a" : "#7c3aed";
  dot.style.boxShadow = type === "pickup" ? "0 8px 18px rgba(22,163,74,0.42)" : "0 8px 18px rgba(124,58,237,0.42)";
  dot.textContent = type === "pickup" ? "P" : "D";

  wrapper.appendChild(dot);
  return wrapper;
}

function routeFeature(
  showRoute: boolean,
  pickupLocation?: LatLng | null,
  dropoffLocation?: LatLng | null,
): GeoJSON.Feature<GeoJSON.LineString> {
  if (showRoute && isValidLocation(pickupLocation) && isValidLocation(dropoffLocation)) {
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

function setMarkerPosition(marker: maplibregl.Marker | null, location?: LatLng | null) {
  if (!marker || !isValidLocation(location)) return;
  marker.setLngLat([location.lng, location.lat]);
}

function DeliveryTrackingMapEditor({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  interactive = false,
  interactionMode = "fixedPin",
  activeField = "pickup",
  showRoute = false,
  followPosition = true,
  onMapCenterChange,
  onPickupChange,
  onDropoffChange,
  className = "h-full w-full rounded-xl",
}: DeliveryTrackingMapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isMapLoadedRef = useRef(false);
  const mapInitInProgressRef = useRef(false);
  const hasInitialCenteredRef = useRef(false);
  const activeFieldRef = useRef<"pickup" | "dropoff">(activeField);
  const onMapCenterChangeRef = useRef<typeof onMapCenterChange>(onMapCenterChange);
  const onPickupChangeRef = useRef<typeof onPickupChange>(onPickupChange);
  const onDropoffChangeRef = useRef<typeof onDropoffChange>(onDropoffChange);

  const pickupLocation = toLngLat(pickupLat, pickupLng);
  const dropoffLocation = toLngLat(dropoffLat, dropoffLng);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    onMapCenterChangeRef.current = onMapCenterChange;
  }, [onMapCenterChange]);

  useEffect(() => {
    onPickupChangeRef.current = onPickupChange;
  }, [onPickupChange]);

  useEffect(() => {
    onDropoffChangeRef.current = onDropoffChange;
  }, [onDropoffChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mapInitInProgressRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    containerRef.current.innerHTML = "";
    mapInitInProgressRef.current = true;
    isMapLoadedRef.current = false;
    hasInitialCenteredRef.current = false;

    const firstLocation = pickupLocation ?? dropoffLocation;
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
      scrollZoom: interactive,
      dragPan: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    pickupMarkerRef.current = new maplibregl.Marker({
      element: createMarkerElement("pickup"),
      draggable: false,
    });
    dropoffMarkerRef.current = new maplibregl.Marker({
      element: createMarkerElement("dropoff"),
      draggable: false,
    });

    const onMapMoveEnd = () => {
      if (!isMapLoadedRef.current) return;
      if (!(interactive && interactionMode === "fixedPin")) return;
      const centerPoint = map.getCenter();
      onMapCenterChangeRef.current?.(centerPoint.lat, centerPoint.lng);
    };

    const onPickupMarkerDragEnd = () => {
      if (!(interactive && interactionMode === "markers")) return;
      const point = pickupMarkerRef.current?.getLngLat();
      if (!point) return;
      onPickupChangeRef.current?.(point.lat, point.lng);
    };

    const onDropoffMarkerDragEnd = () => {
      if (!(interactive && interactionMode === "markers")) return;
      const point = dropoffMarkerRef.current?.getLngLat();
      if (!point) return;
      onDropoffChangeRef.current?.(point.lat, point.lng);
    };

    map.on("moveend", onMapMoveEnd);
    pickupMarkerRef.current.on("dragend", onPickupMarkerDragEnd);
    dropoffMarkerRef.current.on("dragend", onDropoffMarkerDragEnd);

    map.on("load", () => {
      isMapLoadedRef.current = true;
      if (!map.getSource("editor-route")) {
        map.addSource("editor-route", {
          type: "geojson",
          data: routeFeature(showRoute, pickupLocation, dropoffLocation),
        });
      }
      if (!map.getLayer("editor-route-glow")) {
        map.addLayer({
          id: "editor-route-glow",
          type: "line",
          source: "editor-route",
          paint: {
            "line-color": "#22c55e",
            "line-width": 10,
            "line-opacity": 0.16,
            "line-blur": 3.5,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer("editor-route-main")) {
        map.addLayer({
          id: "editor-route-main",
          type: "line",
          source: "editor-route",
          paint: {
            "line-color": "#059669",
            "line-width": 4,
            "line-opacity": 0.95,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }

      if (isValidLocation(pickupLocation)) {
        pickupMarkerRef.current?.setLngLat([pickupLocation.lng, pickupLocation.lat]).addTo(map);
      }
      if (isValidLocation(dropoffLocation)) {
        dropoffMarkerRef.current?.setLngLat([dropoffLocation.lng, dropoffLocation.lat]).addTo(map);
      }
      hasInitialCenteredRef.current = true;
    });

    return () => {
      mapInitInProgressRef.current = false;
      isMapLoadedRef.current = false;
      hasInitialCenteredRef.current = false;
      pickupMarkerRef.current?.off("dragend", onPickupMarkerDragEnd);
      dropoffMarkerRef.current?.off("dragend", onDropoffMarkerDragEnd);
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      map.off("moveend", onMapMoveEnd);
      mapRef.current?.remove();
      mapRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // Initialize once; runtime behavior handled in dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const pickupMarker = pickupMarkerRef.current;
    const dropoffMarker = dropoffMarkerRef.current;
    if (!map || !isMapLoadedRef.current || !pickupMarker || !dropoffMarker) return;

    if (isValidLocation(pickupLocation)) {
      if (!pickupMarker.getElement().parentElement) pickupMarker.addTo(map);
      setMarkerPosition(pickupMarker, pickupLocation);
    } else {
      pickupMarker.remove();
    }

    if (isValidLocation(dropoffLocation)) {
      if (!dropoffMarker.getElement().parentElement) dropoffMarker.addTo(map);
      setMarkerPosition(dropoffMarker, dropoffLocation);
    } else {
      dropoffMarker.remove();
    }
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    const source = mapRef.current?.getSource("editor-route") as maplibregl.GeoJSONSource | undefined;
    if (!source || !isMapLoadedRef.current) return;
    source.setData(routeFeature(showRoute, pickupLocation, dropoffLocation));
  }, [showRoute, pickupLocation, dropoffLocation]);

  useEffect(() => {
    const pickupMarker = pickupMarkerRef.current;
    const dropoffMarker = dropoffMarkerRef.current;
    if (!pickupMarker || !dropoffMarker) return;
    const draggable = interactive && interactionMode === "markers";
    pickupMarker.setDraggable(draggable);
    dropoffMarker.setDraggable(draggable);
  }, [interactive, interactionMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current || !hasInitialCenteredRef.current) return;
    if (followPosition === false) return;

    const primary = activeField === "pickup" ? pickupLocation : dropoffLocation;
    const fallback = activeField === "pickup" ? dropoffLocation : pickupLocation;
    const target = primary ?? fallback;
    if (!isValidLocation(target)) return;
    map.easeTo({ center: [target.lng, target.lat], duration: 450 });
  }, [activeField, pickupLocation, dropoffLocation, followPosition]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const triggerResize = () => {
      const map = mapRef.current;
      if (!map || !isMapLoadedRef.current) return;
      map.resize();
    };

    const delayedResizeId = window.setTimeout(triggerResize, 120);
    const rafId = window.requestAnimationFrame(triggerResize);
    window.addEventListener("resize", triggerResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        triggerResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.clearTimeout(delayedResizeId);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", triggerResize);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div className={`relative bg-gray-100 ${className}`}>
      <div ref={containerRef} className="h-full min-h-[300px] w-full border-2 border-red-500" />
      {interactive && interactionMode === "fixedPin" ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div
              className={`rounded-full border border-white bg-white p-1 shadow ${
                activeField === "pickup" ? "text-emerald-600" : "text-violet-600"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                <path d="M12 2c-3.866 0-7 3.134-7 7 0 4.95 5.509 11.262 6.007 11.824a1.33 1.33 0 0 0 1.986 0C13.491 20.262 19 13.95 19 9c0-3.866-3.134-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
              </svg>
            </div>
            <div className="-mt-1 h-2 w-2 rounded-full bg-black/20 blur-[1px]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(DeliveryTrackingMapEditor);
