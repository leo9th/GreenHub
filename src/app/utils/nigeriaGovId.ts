/** Nigerian government ID types accepted for employment verification */

export type NigeriaGovIdType =
  | "national_id_nin"
  | "drivers_license"
  | "voters_card"
  | "international_passport";

export const NIGERIA_GOV_ID_OPTIONS: { value: NigeriaGovIdType; label: string }[] = [
  { value: "national_id_nin", label: "National ID Card (NIN)" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "international_passport", label: "International Passport" },
];

/** Format validation (heuristic; admin still reviews originals). */
export function isValidNigeriaIdNumber(type: NigeriaGovIdType, raw: string): boolean {
  const v = raw.trim().replace(/\s+/g, "");
  if (!v) return false;
  switch (type) {
    case "national_id_nin":
      return /^\d{11}$/.test(v);
    case "international_passport":
      return /^[A-Za-z]\d{8}$/.test(v);
    case "drivers_license":
      return (
        /^[A-Z]{3}\d{12}[A-Z]\d{2}$/i.test(v) ||
        (/^[A-Z0-9]{10,16}$/i.test(v) && /[A-Z]/i.test(v) && /\d/.test(v))
      );
    case "voters_card":
      return /^[A-Z0-9\-]{12,22}$/i.test(v) && /\d/.test(v);
    default:
      return false;
  }
}

export function normalizePersonName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/gi, "")
    .replace(/\s+/g, " ");
}

/** Require each significant name token to appear in OCR text (OCR may reorder lines). */
export function nameAppearsInOcrText(fullName: string, ocrText: string): boolean {
  const n = normalizePersonName(fullName);
  const parts = n.split(" ").filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  const ocr = normalizePersonName(ocrText);
  return parts.every((p) => ocr.includes(p));
}
