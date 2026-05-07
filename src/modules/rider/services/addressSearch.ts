import { searchAddressSuggestions as searchOsm, reverseGeocode as reverseOsm } from "../../../app/utils/osmGeocode";

export type LocationSuggestion = {
  id?: string;
  display_name: string;
  lat: number;
  lng: number;
};

export function mapboxAccessToken(): string | undefined {
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

/** Nigeria-biased suggestions: Mapbox when token present, else OSM Nominatim. */
export async function searchAddressesNg(query: string): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (mapboxAccessToken()) {
    if (q.length < 2) return [];
    return searchMapboxPlacesNg(q);
  }
  if (q.length < 3) return [];
  const rows = await searchOsm(q);
  return rows.map((r) => ({ display_name: r.display_name, lat: r.lat, lng: r.lng }));
}

export function suggestMinQueryLength(): number {
  return mapboxAccessToken() ? 2 : 3;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  return reverseOsm(lat, lng);
}
