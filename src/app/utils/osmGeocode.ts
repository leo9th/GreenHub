export type AddressSuggestion = { display_name: string; lat: number; lng: number };

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return rows
    .map((row) => ({
      display_name: String(row.display_name ?? "").trim(),
      lat: Number(row.lat),
      lng: Number(row.lon),
    }))
    .filter((row) => row.display_name && Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat),
    )}&lon=${encodeURIComponent(String(lng))}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const row = (await res.json()) as { display_name?: string };
  const v = String(row.display_name ?? "").trim();
  return v || null;
}
