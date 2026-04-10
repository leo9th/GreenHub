/**
 * GreenHub timestamps: relative copy in **Africa/Lagos** (WAT, UTC+1).
 * Examples: "Just now", "5 minutes ago", "Yesterday at 9:00 PM", "April 9, 2026".
 */

export const GREENHUB_TIME_ZONE = "Africa/Lagos";

function toValidDate(input: string | Date | null | undefined): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD in Lagos for an instant */
export function ymdInLagos(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: GREENHUB_TIME_ZONE });
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatFullDateLagos(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENHUB_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatTimeLagos(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENHUB_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Absolute date + time in Lagos (e.g. admin rows). */
export function formatGreenHubDateTime(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "";
  const datePart = formatFullDateLagos(d);
  const timePart = formatTimeLagos(d);
  return `${datePart} at ${timePart}`;
}

/** Calendar date only: "April 9, 2026" */
export function formatGreenHubFullDate(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "";
  return formatFullDateLagos(d);
}

/** Short month + year for profiles: "Jan 2024" */
export function formatGreenHubMonthYear(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENHUB_TIME_ZONE,
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Primary relative formatter for listings, reviews, notifications, chat meta, etc.
 */
export function formatGreenHubRelative(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  const todayYmd = ymdInLagos(now);
  const dYmd = ymdInLagos(d);
  const yesterdayYmd = addDaysToYmd(todayYmd, -1);

  if (diffMs < 0) {
    return formatFullDateLagos(d);
  }

  if (dYmd === todayYmd) {
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3600_000) {
      const n = Math.floor(diffMs / 60_000);
      return n === 1 ? "1 minute ago" : `${n} minutes ago`;
    }
    const h = Math.floor(diffMs / 3600_000);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }

  if (dYmd === yesterdayYmd) {
    return `Yesterday at ${formatTimeLagos(d)}`;
  }

  return formatFullDateLagos(d);
}

/** Chat day pills: "Today" | "Yesterday" | "April 9, 2026" */
export function formatGreenHubDayDivider(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "";

  const todayYmd = ymdInLagos(new Date());
  const dYmd = ymdInLagos(d);
  const yesterdayYmd = addDaysToYmd(todayYmd, -1);

  if (dYmd === todayYmd) return "Today";
  if (dYmd === yesterdayYmd) return "Yesterday";
  return formatFullDateLagos(d);
}

/** Clock time in Lagos (e.g. live UI clock). */
export function formatGreenHubTimeNow(): string {
  return formatTimeLagos(new Date());
}
