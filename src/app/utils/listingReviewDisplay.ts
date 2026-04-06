/**
 * Prefer `products.average_rating` / `total_reviews` (from `product_reviews` triggers),
 * fallback to legacy `rating` / `reviews` columns on `products`.
 */
export function getListingAverageRating(p: Record<string, unknown>): number {
  const avg = p.average_rating;
  if (avg != null && avg !== "" && Number.isFinite(Number(avg))) {
    return Math.round(Number(avg) * 10) / 10;
  }
  const legacy = p.rating;
  if (legacy != null && legacy !== "" && Number.isFinite(Number(legacy))) {
    return Math.round(Number(legacy) * 10) / 10;
  }
  return 0;
}

/** Undefined when count is 0 — ProductCard hides the count segment. */
export function getListingReviewCount(p: Record<string, unknown>): number | undefined {
  const t = p.total_reviews;
  if (t != null && t !== "" && Number.isFinite(Number(t))) {
    const n = Math.max(0, Math.floor(Number(t)));
    return n > 0 ? n : undefined;
  }
  const legacy = p.reviews;
  if (legacy != null && legacy !== "" && Number.isFinite(Number(legacy))) {
    const n = Math.max(0, Math.floor(Number(legacy)));
    return n > 0 ? n : undefined;
  }
  return undefined;
}
