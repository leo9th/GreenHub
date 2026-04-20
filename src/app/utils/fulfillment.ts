/** One flat warehouse shipping charge per order when any Guaranteed item is present. */
export const GUARANTEED_FLAT_SHIPPING_NGN = 2000;

export function isWarehouseShippingFulfillment(ft: string | null | undefined): boolean {
  return typeof ft === "string" && ft.trim() === "warehouse_shipping";
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
