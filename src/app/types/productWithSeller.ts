/**
 * Embedded `profiles` row when joining products with:
 * `seller:profiles!products_seller_id_fkey(full_name, avatar_url, rating)`
 */
export interface Seller {
  full_name: string;
  avatar_url: string | null;
  rating: number | null;
}

/** Product row from Supabase with nested seller join (explicit FK hint). */
export type ProductWithSeller = Record<string, unknown> & {
  seller: Seller | null;
};

/** Alias: listing row including embedded seller profile fields. */
export type Product = ProductWithSeller;
