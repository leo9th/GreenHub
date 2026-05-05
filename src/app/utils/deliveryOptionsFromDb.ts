export type ParsedDeliveryOption = { name: string; fee: number; duration: string };

/** Aligns with ProductDetail / seller `delivery_options` shapes (text[], JSON string, or array of strings/objects). */
export function parseDeliveryOptionsFromDb(raw: unknown): ParsedDeliveryOption[] {
  if (raw == null) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) arr = p;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  const out: ParsedDeliveryOption[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t.startsWith("{")) {
        try {
          const o = JSON.parse(t) as Record<string, unknown>;
          const name = typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
          if (!name) continue;
          const feeRaw = o.fee;
          const feeNum = typeof feeRaw === "number" && Number.isFinite(feeRaw) ? feeRaw : Number(feeRaw);
          out.push({
            name,
            fee: Number.isFinite(feeNum) ? feeNum : 0,
            duration: typeof o.duration === "string" ? o.duration : String(o.duration ?? ""),
          });
          continue;
        } catch {
          /* fall through to plain string */
        }
      }
      const name = t;
      if (name) out.push({ name, fee: 0, duration: "" });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
      if (!name) continue;
      const feeRaw = o.fee;
      const feeNum = typeof feeRaw === "number" && Number.isFinite(feeRaw) ? feeRaw : Number(feeRaw);
      out.push({
        name,
        fee: Number.isFinite(feeNum) ? feeNum : 0,
        duration: typeof o.duration === "string" ? o.duration : String(o.duration ?? ""),
      });
    }
  }
  return out;
}
