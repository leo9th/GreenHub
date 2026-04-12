/** Preset ids stored in `products.shipping_destinations` and as keys in `international_shipping_fees`. */
export const INTERNATIONAL_SHIPPING_PRESETS = [
  { id: "usa", flag: "🇺🇸", label: "USA", hint: "America", defaultDuration: "7-14 days", defaultFee: 0 },
  { id: "uk", flag: "🇬🇧", label: "UK", hint: "London", defaultDuration: "7-14 days", defaultFee: 0 },
  { id: "canada", flag: "🇨🇦", label: "Canada", hint: "Canada", defaultDuration: "7-14 days", defaultFee: 0 },
  { id: "germany", flag: "🇩🇪", label: "Germany", hint: "Belgium / Europe", defaultDuration: "7-14 days", defaultFee: 0 },
  { id: "dubai", flag: "🇦🇪", label: "Dubai", hint: "UAE", defaultDuration: "7-14 days", defaultFee: 0 },
  { id: "china", flag: "🇨🇳", label: "China", hint: "China", defaultDuration: "7-14 days", defaultFee: 0 },
] as const;

export type InternationalPresetId = (typeof INTERNATIONAL_SHIPPING_PRESETS)[number]["id"];

export type InternationalShippingFeeRow = { fee: number; duration: string };

export function getPresetById(id: string) {
  return INTERNATIONAL_SHIPPING_PRESETS.find((p) => p.id === id);
}

/** Build rows for product detail / checkout (name includes flag + destination). */
export function buildInternationalDeliveryOptions(
  destinations: unknown,
  feesRaw: unknown,
): { name: string; fee: number; duration: string }[] {
  const fees = parseInternationalShippingFees(feesRaw);
  const ids = Array.isArray(destinations) ? destinations.filter((x): x is string => typeof x === "string") : [];
  return ids.map((id) => {
    const preset = getPresetById(id);
    const row = fees[id];
    const fee = row?.fee ?? 0;
    const duration = row?.duration ?? "7-14 days";
    const name = preset ? `${preset.flag} ${preset.label} (${preset.hint})` : `International (${id})`;
    return { name, fee, duration };
  });
}

export function parseInternationalShippingFees(raw: unknown): Record<string, InternationalShippingFeeRow> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, InternationalShippingFeeRow> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const feeRaw = o.fee;
    const feeNum = typeof feeRaw === "number" && Number.isFinite(feeRaw) ? feeRaw : Number(feeRaw);
    const duration = typeof o.duration === "string" ? o.duration : String(o.duration ?? "");
    out[k] = {
      fee: Number.isFinite(feeNum) ? feeNum : 0,
      duration: duration || "7-14 days",
    };
  }
  return out;
}
