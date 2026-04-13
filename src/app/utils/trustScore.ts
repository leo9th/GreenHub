/**
 * Simple trust heuristic (0–100). Replace with DB `profiles.trust_score` when populated.
 */
export function computeTrustScore(input: {
  verifiedSeller?: boolean;
  reviewCount?: number;
  avgRating?: number;
}): number {
  let s = 40;
  if (input.verifiedSeller) s += 25;
  const n = input.reviewCount ?? 0;
  const r = input.avgRating ?? 0;
  s += Math.min(20, n * 2);
  s += Math.min(15, Math.max(0, r - 3) * 5);
  return Math.min(100, Math.round(s));
}
