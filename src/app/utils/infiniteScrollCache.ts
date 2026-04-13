/** Short-lived cache for listing batches to avoid duplicate RPC when revisiting same filter. */

type BatchPayload = {
  rows: Record<string, unknown>[];
  total: number;
  startOffset: number;
  endOffset: number;
};

const store = new Map<string, BatchPayload>();
const TTL_MS = 60_000;
const times = new Map<string, number>();

export function getCachedListingBatch(key: string): BatchPayload | null {
  const t = times.get(key);
  if (t == null || Date.now() - t > TTL_MS) {
    store.delete(key);
    times.delete(key);
    return null;
  }
  return store.get(key) ?? null;
}

export function setCachedListingBatch(key: string, payload: BatchPayload) {
  store.set(key, payload);
  times.set(key, Date.now());
}

export function clearListingCache() {
  store.clear();
  times.clear();
}
