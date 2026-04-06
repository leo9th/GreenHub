export type BoostTier = "daily" | "weekly" | "monthly" | "yearly";

export const BOOST_TIERS: {
  id: BoostTier;
  label: string;
  durationLabel: string;
  durationDays: number;
  /** NGN — Paystack for Nigeria */
  priceNgn: number;
}[] = [
  { id: "daily", label: "Daily", durationLabel: "1 day", durationDays: 1, priceNgn: 500 },
  { id: "weekly", label: "Weekly", durationLabel: "7 days", durationDays: 7, priceNgn: 3000 },
  { id: "monthly", label: "Monthly", durationLabel: "30 days", durationDays: 30, priceNgn: 10000 },
  { id: "yearly", label: "Yearly", durationLabel: "365 days", durationDays: 365, priceNgn: 100000 },
];

export function getBoostTier(id: string | null | undefined): (typeof BOOST_TIERS)[number] | undefined {
  const t = String(id ?? "").toLowerCase();
  return BOOST_TIERS.find((x) => x.id === t);
}

export function isBoostActive(boostExpiresAt: unknown): boolean {
  if (boostExpiresAt == null || boostExpiresAt === "") return false;
  const t = new Date(String(boostExpiresAt)).getTime();
  return Number.isFinite(t) && t > Date.now();
}
