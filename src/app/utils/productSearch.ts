import type { SupabaseClient } from "@supabase/supabase-js";
import { isBoostActive } from "./boost";
import { getProductPrice } from "./getProductPrice";
import { getListingAverageRating, getListingReviewCount } from "./listingReviewDisplay";

export const MAX_SEARCH_TERM_LENGTH = 120;
/** Listings page (/products): page size for Supabase `.range()` and numbered pagination */
export const PRODUCTS_PAGE_SIZE = 20;
/** Home featured grid: initial batch and each "Load more" */
export const HOME_PAGE_SIZE = 20;

/** 1-based page from URL `?page=` (default 1). */
export function parseListingPageParam(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Page numbers for numbered pagination (1-based), with ellipsis when gaps exist. */
export function listingPaginationItems(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const want = new Set<number>([1, totalPages]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= totalPages) want.add(i);
  }
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

export type ListingSort = "recent" | "price-low" | "price-high" | "rating";

export const LISTING_SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating", label: "Highest rated" },
];

export function parseListingSort(raw: string | null | undefined): ListingSort {
  const allowed: ListingSort[] = ["recent", "price-low", "price-high", "rating"];
  const s = String(raw || "").trim();
  return allowed.includes(s as ListingSort) ? (s as ListingSort) : "recent";
}

export type ListingFilterOpts = {
  category: string;
  condition: string;
  state: string;
  priceRange: string;
  /** Exact `products.car_brand` match when category is vehicles */
  carBrand: string;
  /** Exact `products.subcategory` match when category is electronics */
  subcategory: string;
};

/** Strip LIKE wildcards and trim so user search is safe for ilike patterns */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%_\\"]/g, "").trim().slice(0, MAX_SEARCH_TERM_LENGTH);
}

/**
 * Active listings only. Uses strict status = 'active' (aligns with seller flow).
 */
export function activeProductsQuery(client: SupabaseClient, columns = "*") {
  return client.from("products").select(columns).eq("status", "active").order("created_at", { ascending: false });
}

/**
 * Case-insensitive partial match on listing title only (returns all active products that match).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSearchOr(query: any, sanitizedTerm: string) {
  const t = sanitizedTerm.trim();
  if (!t) return query;
  const p = `%${t}%`;
  return query.ilike("title", p);
}

/**
 * Paged listing with total count (PostgREST).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listingBaseQuery(client: SupabaseClient): any {
  return client.from("products").select("*", { count: "exact" }).eq("status", "active");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function priceRangeToMinMax(priceRange: string): { min: number | null; max: number | null } {
  if (!priceRange || priceRange === "all") return { min: null, max: null };
  const parts = priceRange.split("-");
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: null, max: null };
  return { min, max };
}

export function applyListingFilters(query: any, opts: ListingFilterOpts) {
  let q = query;
  if (opts.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts.condition && opts.condition !== "all") q = q.eq("condition", opts.condition);
  if (opts.state && opts.state !== "all") {
    q = q.ilike("location", `%${opts.state}%`);
  }
  if (opts.priceRange && opts.priceRange !== "all") {
    const parts = opts.priceRange.split("-");
    const min = Number(parts[0]);
    const max = Number(parts[1]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      q = q.gte("price_local", min).lte("price_local", max);
    }
  }
  if (opts.category === "vehicles" && opts.carBrand && opts.carBrand !== "all") {
    q = q.eq("car_brand", opts.carBrand);
  }
  if (opts.category === "electronics" && opts.subcategory && opts.subcategory !== "all") {
    q = q.eq("subcategory", opts.subcategory);
  }
  return q;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyListingSort(query: any, sortBy: ListingSort) {
  switch (sortBy) {
    case "price-low":
      return query
        .order("price_local", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
    case "price-high":
      return query
        .order("price_local", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    case "rating":
      // Denormalized `average_rating` from product_reviews; unreviewed listings sort last.
      return query
        .order("average_rating", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    case "recent":
    default:
      return query.order("created_at", { ascending: false });
  }
}

/** Client-side sort for cached lists (e.g. Home). Uses same semantics as `applyListingSort`. */
export function sortProductsClientSide(
  rows: Array<Record<string, unknown>>,
  sortBy: ListingSort,
): Array<Record<string, unknown>> {
  const arr = [...rows];
  const price = (r: Record<string, unknown>) => Number(r.price) || 0;
  const created = (r: Record<string, unknown>) => {
    const raw = r.created_at ?? r.createdAt;
    const t = raw != null ? new Date(String(raw)).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };

  const avgRating = (r: Record<string, unknown>) => {
    const a = r.average_rating;
    if (a != null && a !== "" && Number.isFinite(Number(a))) return Number(a);
    const leg = r.rating;
    if (leg != null && leg !== "" && Number.isFinite(Number(leg))) return Number(leg);
    return -1;
  };

  switch (sortBy) {
    case "price-low":
      return arr.sort((a, b) => price(a) - price(b) || created(b) - created(a));
    case "price-high":
      return arr.sort((a, b) => price(b) - price(a) || created(b) - created(a));
    case "rating":
      return arr.sort((a, b) => avgRating(b) - avgRating(a) || created(b) - created(a));
    case "recent":
    default:
      return arr.sort((a, b) => created(b) - created(a));
  }
}

/** Client-side lists (e.g. Recently viewed): boosted first, then priority, then `sortBy`. */
export function sortProductsWithBoostFirst(
  rows: Array<Record<string, unknown>>,
  sortBy: ListingSort,
): Array<Record<string, unknown>> {
  const arr = [...rows];
  const price = (r: Record<string, unknown>) => Number(r.price) || 0;
  const created = (r: Record<string, unknown>) => {
    const raw = r.created_at ?? r.createdAt;
    const t = raw != null ? new Date(String(raw)).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  const avgRating = (r: Record<string, unknown>) => {
    const a = r.average_rating;
    if (a != null && a !== "" && Number.isFinite(Number(a))) return Number(a);
    const leg = r.rating;
    if (leg != null && leg !== "" && Number.isFinite(Number(leg))) return Number(leg);
    return -1;
  };

  arr.sort((a, b) => {
    const ab = isBoostActive(a.boost_expires_at);
    const bb = isBoostActive(b.boost_expires_at);
    if (ab !== bb) return ab ? -1 : 1;
    if (ab && bb) {
      const ps = Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0);
      if (ps !== 0) return ps;
    }
    switch (sortBy) {
      case "price-low":
        return price(a) - price(b) || created(b) - created(a);
      case "price-high":
        return price(b) - price(a) || created(b) - created(a);
      case "rating":
        return avgRating(b) - avgRating(a) || created(b) - created(a);
      case "recent":
      default:
        return created(b) - created(a);
    }
  });
  return arr;
}

export async function fetchProductsListingRpc(
  client: SupabaseClient,
  opts: {
    searchTerm: string;
    filterOpts: ListingFilterOpts;
    sortBy: ListingSort;
    limit: number;
    offset: number;
  },
): Promise<{ rows: Record<string, unknown>[]; total: number; error: string | null }> {
  const term = sanitizeSearchTerm(opts.searchTerm);
  const { min: pMin, max: pMax } = priceRangeToMinMax(opts.filterOpts.priceRange);

  const { data, error } = await client.rpc("rpc_products_listing", {
    p_search: term || null,
    p_category: opts.filterOpts.category === "all" ? null : opts.filterOpts.category,
    p_condition: opts.filterOpts.condition === "all" ? null : opts.filterOpts.condition,
    p_car_brand: opts.filterOpts.carBrand === "all" ? null : opts.filterOpts.carBrand,
    p_subcategory: opts.filterOpts.subcategory === "all" ? null : opts.filterOpts.subcategory,
    p_state: opts.filterOpts.state === "all" ? null : opts.filterOpts.state,
    p_price_min: pMin,
    p_price_max: pMax,
    p_sort: opts.sortBy,
    p_limit: opts.limit,
    p_offset: opts.offset,
  });

  if (error) {
    return { rows: [], total: 0, error: error.message };
  }

  const payload = data as { total?: number; rows?: Record<string, unknown>[] } | null;
  const total = typeof payload?.total === "number" ? payload.total : 0;
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return { rows, total, error: null };
}

/** Map a Supabase row to app product shape */
export function mapProductRow(product: Record<string, unknown>) {
  return {
    ...product,
    price: getProductPrice(product as { price?: unknown; price_local?: unknown }),
    rating: getListingAverageRating(product),
    reviews: getListingReviewCount(product),
    sellerId: product.seller_id,
    sellerTier: product.seller_tier,
    deliveryOptions: product.delivery_options,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}
