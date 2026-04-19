/**
 * Embedded `profiles` row when joining products with:
 * `seller:profiles!products_seller_id_fkey(full_name, username, avatar_url, rating, phone_verified)`
 */
export interface Seller {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  rating?: number | null;
  /** SMS-verified phone on profile (trust signal for cards). */
  phone_verified?: boolean | null;
}

/** Product row from Supabase with nested seller join (explicit FK hint). */
export type ProductWithSeller = Record<string, unknown> & {
  seller: Seller | null;
};

/** Alias: listing row including embedded seller profile fields. */
export type Product = ProductWithSeller;
