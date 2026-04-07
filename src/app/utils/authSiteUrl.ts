/**
 * Origin used in Supabase auth `redirectTo` / `emailRedirectTo`.
 * Must appear in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * (e.g. http://localhost:5173/reset-password and your production URL).
 *
 * Set `VITE_SITE_URL` when the canonical site URL differs from `window.location.origin`
 * (e.g. dev proxies, preview vs production Supabase settings).
 */
export function getAuthSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export function authRedirectTo(path: string): string {
  const base = getAuthSiteOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
