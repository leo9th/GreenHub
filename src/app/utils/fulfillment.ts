/** One flat warehouse shipping charge per order when any Guaranteed item is present. */
export const GUARANTEED_FLAT_SHIPPING_NGN = 2000;

export function isWarehouseShippingFulfillment(ft: string | null | undefined): boolean {
  return typeof ft === "string" && ft.trim() === "warehouse_shipping";
}

/** Aligns with Checkout: all lines warehouse/guaranteed → store (b2c); otherwise marketplace (c2c). */
export function deriveMarketModeFromLineItems(items: { fulfillment_type?: string | null }[]): "c2c" | "b2c" {
  return items.every((item) => isWarehouseShippingFulfillment(item.fulfillment_type)) ? "b2c" : "c2c";
}

export function computeHybridDeliveryTotals(
  items: { fulfillment_type?: string | null; deliveryFee: number }[],
): { guaranteedFlat: number; marketplaceSellerFees: number; total: number } {
  const hasGuaranteed = items.some((i) => isWarehouseShippingFulfillment(i.fulfillment_type));
  const guaranteedFlat = hasGuaranteed ? GUARANTEED_FLAT_SHIPPING_NGN : 0;
  const marketplaceSellerFees = items
    .filter((i) => !isWarehouseShippingFulfillment(i.fulfillment_type))
    .reduce((s, i) => s + i.deliveryFee, 0);
  return {
    guaranteedFlat,
    marketplaceSellerFees,
    total: guaranteedFlat + marketplaceSellerFees,
  };
}
