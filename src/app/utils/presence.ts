import { formatGreenHubRelative } from "./formatGreenHubTime";

/** Within this window we show the green "online" dot. */
export const ONLINE_THRESHOLD_MIN = 5;

export function isOnlineFromLastActive(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_THRESHOLD_MIN * 60 * 1000;
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Last seen long ago";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Last seen long ago";
  const rel = formatGreenHubRelative(iso);
  if (rel === "Just now") return "Last seen just now";
  return `Last seen ${rel}`;
}
