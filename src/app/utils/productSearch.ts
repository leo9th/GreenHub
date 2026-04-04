import type { SupabaseClient } from "@supabase/supabase-js";
import { getProductPrice } from "./getProductPrice";

export const MAX_SEARCH_TERM_LENGTH = 120;

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
 * Case-insensitive match on title, description, or category (OR).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSearchOr(query: any, sanitizedTerm: string) {
  const t = sanitizedTerm.trim();
  if (!t) return query;
  const p = `%${t}%`;
  return query.or(`title.ilike."${p}",description.ilike."${p}",category.ilike."${p}"`);
}

/** Map a Supabase row to app product shape */
export function mapProductRow(product: Record<string, unknown>) {
  return {
    ...product,
    price: getProductPrice(product as { price?: unknown; price_local?: unknown }),
    sellerId: product.seller_id,
    sellerTier: product.seller_tier,
    deliveryOptions: product.delivery_options,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

export const PRODUCTS_PAGE_SIZE = 20;

export type ListingSort = "recent" | "price-low" | "price-high" | "rating";

/**
 * Base select for /products listing: active rows + total row count for pagination.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listingBaseQuery(client: SupabaseClient): any {
  return client.from("products").select("*", { count: "exact" }).eq("status", "active");
}

export type ListingFilterOpts = {
  category: string;
  condition: string;
  state: string;
  priceRange: string;
};

/**
 * Apply sidebar / modal filters (category, condition, state, price band).
 * Price uses OR across `price_local` and legacy `price` so either column can match.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyListingFilters(query: any, opts: ListingFilterOpts) {
  let q = query;
  if (opts.category && opts.category !== "all") {
    q = q.ilike("category", opts.category.trim());
  }
  if (opts.condition && opts.condition !== "all") {
    q = q.eq("condition", opts.condition);
  }
  if (opts.state && opts.state !== "all") {
    const s = opts.state.replace(/[%_\\"]/g, "").trim();
    if (s) q = q.ilike("location", `%${s}%`);
  }
  if (opts.priceRange && opts.priceRange !== "all") {
    const parts = opts.priceRange.split("-");
    const min = Number(parts[0]);
    const max = Number(parts[1]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      q = q.or(
        `and(price_local.gte.${min},price_local.lte.${max}),and(price.gte.${min},price.lte.${max})`,
      );
    }
  }
  return q;
}

/** Server-side sort for listings (secondary key keeps order stable). */
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
      return query.order("rating", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    default:
      return query.order("created_at", { ascending: false });
  }
}
