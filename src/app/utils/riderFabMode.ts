export type RiderFabMode = "booking" | "rider";

export function riderFabModeStorageKey(userId: string): string {
  const safeUserId = userId.trim();
  return `gh_rider_presence_mode:${safeUserId || "anon"}`;
}

export function normalizeRiderFabMode(value: string | null | undefined): RiderFabMode | null {
  if (value === "booking" || value === "rider") return value;
  return null;
}

export function resolveInitialRiderFabMode(params: {
  isRiderCapable: boolean;
  savedMode: RiderFabMode | null;
}): RiderFabMode {
  const { isRiderCapable, savedMode } = params;
  if (!isRiderCapable) return "booking";
  return savedMode ?? "rider";
}
