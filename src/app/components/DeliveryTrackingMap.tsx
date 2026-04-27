import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface DeliveryTrackingMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  riderLat?: number | null;
  riderLng?: number | null;
  className?: string;
  interactive?: boolean;
  interactionMode?: "fixedPin" | "markers";
  activeField?: "pickup" | "dropoff";
  showRoute?: boolean;
  onMapCenterChange?: (lat: number, lng: number) => void;
  onPickupChange?: (lat: number, lng: number) => void;
  onDropoffChange?: (lat: number, lng: number) => void;
  followPosition?: boolean;
}

function RecenterMap({
  centerLat,
  centerLng,
}: {
  centerLat: number;
  centerLng: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([centerLat, centerLng], map.getZoom(), { animate: true });
  }, [centerLat, centerLng, map]);

  return null;
}

function CenterReporter({
  enabled,
  onCenterChange,
}: {
  enabled: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    moveend(mapEvent) {
      if (!enabled || !onCenterChange) return;
      const c = mapEvent.target.getCenter();
      onCenterChange(c.lat, c.lng);
    },
  });
  return null;
}

export default function DeliveryTrackingMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  riderLat,
  riderLng,
  className = "h-64 w-full rounded-lg",
  interactive = false,
  interactionMode = "fixedPin",
  activeField = "pickup",
  showRoute = false,
  onMapCenterChange,
  onPickupChange,
  onDropoffChange,
  followPosition = true,
}: DeliveryTrackingMapProps) {
  const centerLat = riderLat ?? pickupLat ?? dropoffLat ?? 9.082;
  const centerLng = riderLng ?? pickupLng ?? dropoffLng ?? 8.6753;
  const routePoints =
    showRoute && pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null
      ? ([
          [pickupLat, pickupLng],
          [dropoffLat, dropoffLng],
        ] as [number, number][])
      : null;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        className={className}
        style={{ height: "100%", width: "100%", minHeight: "300px" }}
        scrollWheelZoom={interactive}
        zoomControl={interactive}
      >
      {followPosition ? <RecenterMap centerLat={centerLat} centerLng={centerLng} /> : null}
      <CenterReporter
        enabled={interactive && interactionMode === "fixedPin"}
        onCenterChange={(lat, lng) => {
          if (!onMapCenterChange) return;
          onMapCenterChange(lat, lng);
        }}
      />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pickupLat != null && pickupLng != null ? (
        <Marker
          position={[pickupLat, pickupLng]}
          draggable={interactive && interactionMode === "markers"}
          eventHandlers={{
            dragend: (event) => {
              if (!onPickupChange || !(interactive && interactionMode === "markers")) return;
              const p = event.target.getLatLng();
              onPickupChange(p.lat, p.lng);
            },
          }}
        >
          <Popup>Pickup location</Popup>
        </Marker>
      ) : null}
      {dropoffLat != null && dropoffLng != null ? (
        <Marker
          position={[dropoffLat, dropoffLng]}
          draggable={interactive && interactionMode === "markers"}
          eventHandlers={{
            dragend: (event) => {
              if (!onDropoffChange || !(interactive && interactionMode === "markers")) return;
              const p = event.target.getLatLng();
              onDropoffChange(p.lat, p.lng);
            },
          }}
        >
          <Popup>Delivery address</Popup>
        </Marker>
      ) : null}
      {riderLat != null && riderLng != null ? (
        <Marker position={[riderLat, riderLng]}>
          <Popup>Rider is here</Popup>
        </Marker>
      ) : null}
      {routePoints ? (
        <>
          <Polyline positions={routePoints} pathOptions={{ color: "#16a34a", weight: 6, opacity: 0.25 }} />
          <Polyline positions={routePoints} pathOptions={{ color: "#059669", weight: 4, opacity: 0.95, lineCap: "round" }} />
        </>
      ) : null}
      </MapContainer>
      {interactive && interactionMode === "fixedPin" ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="flex flex-col items-center">
            <MapPinIcon color={activeField === "pickup" ? "text-emerald-600" : "text-violet-600"} />
            <div className="-mt-1 h-2 w-2 rounded-full bg-black/20 blur-[1px]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapPinIcon({ color }: { color: string }) {
  return (
    <div className={`rounded-full border border-white bg-white p-1 shadow ${color}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M12 2c-3.866 0-7 3.134-7 7 0 4.95 5.509 11.262 6.007 11.824a1.33 1.33 0 0 0 1.986 0C13.491 20.262 19 13.95 19 9c0-3.866-3.134-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
      </svg>
    </div>
  );
}
