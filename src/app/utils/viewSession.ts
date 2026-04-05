const STORAGE_KEY = "gh_anon_view_session_v1";

/** Stable anonymous key for unique product views (stored in localStorage). */
export function getOrCreateAnonViewSession(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 12) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return "";
  }
}
