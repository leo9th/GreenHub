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
    const raw = fromEnv.trim().replace(/\/$/, "");
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const u = new URL(withScheme);
      return `${u.protocol}//${u.host}`;
    } catch {
      return raw;
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** Vite base path (e.g. `/` or `/app`) so auth redirects work when the app is not hosted at domain root. */
function viteBasePath(): string {
  const raw = String(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return raw === "" || raw === "/" ? "" : raw;
}

export function authRedirectTo(path: string): string {
  const origin = getAuthSiteOrigin();
  const basePath = viteBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${basePath}${p}`;
}
