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
