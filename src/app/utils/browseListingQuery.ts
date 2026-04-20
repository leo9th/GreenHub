import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductWithSeller } from "../types/productWithSeller";
import {
  type ListingSort,
  applyListingSort,
  normalizedGlobalSearchTerm,
  priceRangeToMinMax,
  productGlobalSearchOrString,
  productsSelectWithSellerEmbed,
} from "./productSearch";

/** Presets for visible price band filter (home + shop). */
export const BROWSE_PRICE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Any price" },
  { value: "0-50000", label: "Under ₦50,000" },
  { value: "50000-200000", label: "₦50k – ₦200k" },
  { value: "200000-1000000", label: "₦200k – ₦1M" },
  { value: "1000000-999999999", label: "Above ₦1M" },
];

/** Fallback grid when browse filters return no rows (home + shop). */
export const RECOMMENDED_FALLBACK_LIMIT = 10;

/**
 * Active listings only, ignoring search/condition/price/drawer filters.
 * Optional `categorySlug` narrows to one category; omit for marketplace-wide picks.
 * Ordered by engagement: `views`, then `like_count`, then recency (same select as main grid).
 */
export async function fetchRecommendedFallbackProducts(
  client: SupabaseClient,
  options?: { categorySlug?: string | null; limit?: number },
): Promise<{ rows: ProductWithSeller[]; error: string | null }> {
  const cap = options?.limit ?? RECOMMENDED_FALLBACK_LIMIT;
  const limit = Math.min(Math.max(cap, 1), 50);

  let query = client.from("products").select(productsSelectWithSellerEmbed()).eq("status", "active");

  const slug = options?.categorySlug?.trim();
  if (slug) {
    query = query.eq("category", slug);
  }

  query = query
    .order("views", { ascending: false, nullsFirst: false })
    .order("like_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = ((data as ProductWithSeller[]) ?? []).filter(Boolean);
  return { rows, error: null };
}

/** Extra filters shown in the “More filters” drawer (home + shop). */
export type BrowseMoreFiltersState = {
  locationContains: string;
  brandContains: string;
  deliveryMode: "all" | "has_options";
};

export function defaultBrowseMoreFilters(): BrowseMoreFiltersState {
  return { locationContains: "", brandContains: "", deliveryMode: "all" };
}

export function sanitizeBrowseIlike(s: string): string {
  return s.replace(/[%_\\"]/g, "").trim();
}

/**
 * Apply price band, sort, global search OR-clause, and drawer filters to an active `products` query.
 * Call after `.from("products").select(...).eq("status", "active")` (and optional `.eq("category", ...)`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBrowseProductQueryFilters(
  query: any,
  opts: {
    condition?: string;
    priceRange: string;
    sortBy: ListingSort;
    more: BrowseMoreFiltersState;
    searchTermRaw: string;
    sellerIds: readonly string[];
  },
): any {
  let q = query;
  if (opts.condition && opts.condition !== "all") {
    q = q.eq("condition", opts.condition);
  }
  const { min, max } = priceRangeToMinMax(opts.priceRange);
  if (min != null && max != null) {
    q = q.gte("price_local", min).lte("price_local", max);
  }
  const loc = sanitizeBrowseIlike(opts.more.locationContains);
  if (loc) {
    q = q.ilike("location", `%${loc}%`);
  }
  const br = sanitizeBrowseIlike(opts.more.brandContains);
  if (br) {
    q = q.ilike("car_brand", `%${br}%`);
  }
  if (opts.more.deliveryMode === "has_options") {
    q = q.not("delivery_options", "is", null);
  }
  const searchT = normalizedGlobalSearchTerm(opts.searchTermRaw);
  const orFilter = searchT ? productGlobalSearchOrString(searchT, opts.sellerIds) : null;
  if (orFilter) {
    q = q.or(orFilter);
  }
  return applyListingSort(q, opts.sortBy);
}
