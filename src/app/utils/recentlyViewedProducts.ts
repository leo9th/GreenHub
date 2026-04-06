const STORAGE_KEY = "greenhub_recent_product_views";
const MAX_ITEMS = 12;

/** Fired on `window` after the recent list changes (same tab). */
export const RECENT_VIEWED_EVENT = "greenhub-recent-viewed";

type Entry = { id: string; at: number };

function readEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x): x is Entry => Boolean(x) && typeof (x as Entry).id === "string")
      .map((x) => ({ id: String((x as Entry).id), at: typeof (x as Entry).at === "number" ? (x as Entry).at : 0 }));
  } catch {
    return [];
  }
}

/** Remember a product page visit (most recent first, capped). */
export function recordProductView(productId: string | number): void {
  try {
    const id = String(productId).trim();
    if (!id || id === "undefined" || id === "null") return;

    let list = readEntries().filter((e) => e.id !== id);
    list.unshift({ id, at: Date.now() });
    if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(RECENT_VIEWED_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Ordered ids (newest first) for fetching from Supabase. */
export function getRecentProductIds(): string[] {
  return readEntries().map((e) => e.id);
}
