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
  const diff = Date.now() - t;
  if (diff < 60_000) return "Last seen just now";
  if (diff < 3600_000) return `Last seen ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `Last seen ${Math.floor(diff / 3600_000)}h ago`;
  return `Last seen ${new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}
