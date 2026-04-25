import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
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

export default function DeliveryTrackingMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  riderLat,
  riderLng,
  className = "h-64 w-full rounded-lg",
}: DeliveryTrackingMapProps) {
  const centerLat = riderLat ?? pickupLat ?? dropoffLat ?? 9.082;
  const centerLng = riderLng ?? pickupLng ?? dropoffLng ?? 8.6753;

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={13}
      className={className}
      style={{ height: "100%", width: "100%", minHeight: "300px" }}
    >
      <RecenterMap centerLat={centerLat} centerLng={centerLng} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pickupLat != null && pickupLng != null ? (
        <Marker position={[pickupLat, pickupLng]}>
          <Popup>Pickup location</Popup>
        </Marker>
      ) : null}
      {dropoffLat != null && dropoffLng != null ? (
        <Marker position={[dropoffLat, dropoffLng]}>
          <Popup>Delivery address</Popup>
        </Marker>
      ) : null}
      {riderLat != null && riderLng != null ? (
        <Marker position={[riderLat, riderLng]}>
          <Popup>Rider is here</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
