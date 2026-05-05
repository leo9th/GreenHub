/**
 * Encode/decode domestic `products.delivery_options` for seller flows.
 * Checkout RPC and PDP parsing expect a JSON object with `fee`; PDP `parseDeliveryOptionsFromDb`
 * also requires a non-empty `name` on object entries.
 */

export type DomesticDeliveryMode = "pickup" | "delivery";

export type DecodedDomesticDelivery = {
  mode: DomesticDeliveryMode;
  /** Whole naira, ≥ 0; meaningful when mode is delivery */
  feeNgn: number;
};

function firstDeliveryOptionJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let first: unknown;
  if (Array.isArray(raw) && raw.length > 0) {
    first = raw[0];
  } else if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p) && p.length > 0) first = p[0];
      else if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  } else {
    return null;
  }
  if (first == null) return null;
  if (typeof first === "string" && first.trim().startsWith("{")) {
    try {
      return JSON.parse(first) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof first === "object") return first as Record<string, unknown>;
  return null;
}

/** Read first option fee from DB row for seller form prefill. */
export function decodeDomesticDeliveryFromRow(deliveryOptions: unknown): DecodedDomesticDelivery {
  const o = firstDeliveryOptionJson(deliveryOptions);
  if (!o) return { mode: "pickup", feeNgn: 0 };
  const feeRaw = o.fee;
  const n = typeof feeRaw === "number" && Number.isFinite(feeRaw) ? feeRaw : Number(feeRaw);
  if (!Number.isFinite(n) || n <= 0) return { mode: "pickup", feeNgn: 0 };
  return { mode: "delivery", feeNgn: Math.max(0, Math.round(n)) };
}

/**
 * `text[]` for Postgres: first element is a JSON string with name + fee (checkout / PDP compatible).
 * Returns `null` for pickup-only (clear or omit column).
 */
export function encodeDomesticDeliveryOptionsForDb(
  mode: DomesticDeliveryMode,
  feeInput: string,
): string[] | null {
  if (mode !== "delivery") return null;
  const n = Math.round(Number.parseFloat(String(feeInput).replace(/,/g, "")));
  if (!Number.isFinite(n) || n <= 0) return null;
  return [
    JSON.stringify({
      name: "Seller delivery",
      label: "Seller delivery",
      fee: n,
      duration: "",
    }),
  ];
}
