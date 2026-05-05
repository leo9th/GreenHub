import { getProductPrice } from "./getProductPrice";
import { parseProductImagesFromRow } from "./productImages";
import { parseDeliveryOptionsFromDb } from "./deliveryOptionsFromDb";

/** Snapshot line compatible with `CartItem` (avoids importing CartContext). */
export type CartReconcileLine = {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  sellerId: string;
  deliveryFee: number;
  fulfillment_type?: string | null;
};

function productRowToLine(row: Record<string, unknown>): Omit<CartReconcileLine, "quantity"> {
  const id = String(row.id ?? "");
  const ftRaw = (row as { fulfillment_type?: unknown }).fulfillment_type;
  const ft = (typeof ftRaw === "string" ? ftRaw.trim() : "") || "seller_pickup";
  const isWarehouse = ft === "warehouse_shipping";
  const optsRaw =
    (row as { delivery_options?: unknown }).delivery_options ??
    (row as { deliveryOptions?: unknown }).deliveryOptions;
  const deliveryFee = isWarehouse ? 0 : parseDeliveryOptionsFromDb(optsRaw)[0]?.fee ?? 0;
  const imgs = parseProductImagesFromRow(row as { image?: unknown; images?: unknown });
  return {
    id,
    title: String(row.title ?? ""),
    price: getProductPrice(row as { price?: unknown; price_local?: unknown }),
    image: imgs[0] ?? "",
    sellerId: String((row as { seller_id?: unknown }).seller_id ?? ""),
    deliveryFee,
    fulfillment_type: ft,
  };
}

function isActiveListing(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "active";
}

/**
 * Rebuild cart lines from fresh `products` rows. Removes missing or non-active listings,
 * clamps quantity to stock, and counts metadata vs quantity adjustments separately.
 */
export function reconcileCartLines(
  cart: readonly CartReconcileLine[],
  productRows: readonly Record<string, unknown>[],
): { next: CartReconcileLine[]; removedCount: number; adjustedCount: number; updatedCount: number } {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of productRows) {
    const id = String(r.id ?? "");
    if (id) byId.set(id, r);
  }

  let removedCount = 0;
  let adjustedCount = 0;
  let updatedCount = 0;
  const next: CartReconcileLine[] = [];

  for (const line of cart) {
    const row = byId.get(line.id);
    if (!row || !isActiveListing(row.status)) {
      removedCount += 1;
      continue;
    }

    const patch = productRowToLine(row);
    const stockRaw = (row as { stock_quantity?: unknown }).stock_quantity;
    const stock =
      stockRaw != null && Number.isFinite(Number(stockRaw)) ? Math.max(0, Math.floor(Number(stockRaw))) : null;

    let qty = line.quantity;
    if (stock != null && qty > stock) {
      qty = stock;
      adjustedCount += 1;
    }
    if (stock != null && stock === 0) {
      removedCount += 1;
      continue;
    }
    if (qty <= 0) {
      removedCount += 1;
      continue;
    }

    const metaChanged =
      line.title !== patch.title ||
      line.price !== patch.price ||
      line.image !== patch.image ||
      line.sellerId !== patch.sellerId ||
      line.deliveryFee !== patch.deliveryFee ||
      String(line.fulfillment_type ?? "") !== String(patch.fulfillment_type ?? "");

    if (metaChanged) {
      updatedCount += 1;
    }

    next.push({
      ...line,
      ...patch,
      quantity: qty,
    });
  }

  return { next, removedCount, adjustedCount, updatedCount };
}
