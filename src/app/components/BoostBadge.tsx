import { isBoostActive, type BoostTier } from "../utils/boost";

const TIER_STYLES: Record<
  BoostTier,
  { label: string; className: string }
> = {
  daily: {
    label: "🔹 Boosted",
    className: "bg-sky-100 text-sky-900 border border-sky-200",
  },
  weekly: {
    label: "⭐ Featured",
    className: "bg-[#fef3c7] text-amber-950 border border-[#fbbf24]",
  },
  monthly: {
    label: "⭐⭐ Premium",
    className: "bg-orange-100 text-orange-950 border border-orange-300",
  },
  yearly: {
    label: "👑 Elite",
    className: "bg-purple-100 text-purple-950 border border-purple-300",
  },
};

/** Small badge for product cards (top-right) */
export function BoostCardBadge({ row }: { row: Record<string, unknown> }) {
  const tier = String(row.boost_tier ?? "").toLowerCase() as BoostTier;
  const exp = row.boost_expires_at;
  if (!isBoostActive(exp)) return null;
  const spec = TIER_STYLES[tier];
  if (!spec) return null;
  return (
    <span
      className={`text-[10px] md:text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm ${spec.className}`}
    >
      {spec.label}
    </span>
  );
}

/** Badge for product detail hero (larger) */
export function BoostDetailBadge({ row }: { row: Record<string, unknown> }) {
  const tier = String(row.boost_tier ?? "").toLowerCase() as BoostTier;
  const exp = row.boost_expires_at;
  if (!isBoostActive(exp)) return null;
  const spec = TIER_STYLES[tier];
  if (!spec) return null;
  return (
    <span
      className={`shrink-0 self-end z-[1] text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm ${spec.className}`}
    >
      {spec.label}
    </span>
  );
}
