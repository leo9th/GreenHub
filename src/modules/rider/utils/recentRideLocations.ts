const RECENT_LOCATIONS_KEY = "gh_recent_ride_locations";

export function readRecentRideLocations(): string[] {
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

export function pushRecentRideLocation(value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const next = [trimmed, ...readRecentRideLocations().filter((x) => x !== trimmed)].slice(0, 5);
  window.localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
}
