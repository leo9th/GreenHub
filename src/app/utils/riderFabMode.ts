export type RiderFabMode = "booking" | "rider";

/** GreenHub rider pipeline status from `useRiderPresence` / `greenhub_riders`. */
export type RiderFabGreenHubStatus = "none" | "pending" | "approved" | "blocked";

/** FAB visibility: show only when user has rider role or any GreenHub rider row (pending/approved/blocked). */
export function isRiderFabEligible(isRider: boolean, riderStatus: RiderFabGreenHubStatus): boolean {
  return isRider || riderStatus !== "none";
}

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
