/**
 * Display/checkout price for a listing. Supabase listings store NGN in `price_local`;
 * mocks and legacy rows may use `price` only.
 */
export function getProductPrice(product: { price?: unknown; price_local?: unknown }): number {
  const raw = product.price_local ?? product.price;
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}
