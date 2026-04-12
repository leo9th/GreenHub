/**
 * Mock “fair market” range from title, category, and description.
 * Replace with a real pricing API when available.
 */
export type MarketPricePredictionResult = {
  min: number;
  max: number;
  /** Shown as “Based on N similar items” (blend of heuristic + local listings). */
  similarItemCount: number;
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const KEYWORD_RANGES: Record<string, { min: number; max: number }> = {
  "human hair": { min: 150_000, max: 200_000 },
  wig: { min: 50_000, max: 150_000 },
  phone: { min: 100_000, max: 500_000 },
  laptop: { min: 300_000, max: 1_000_000 },
  iphone: { min: 200_000, max: 900_000 },
  samsung: { min: 80_000, max: 600_000 },
  shoes: { min: 15_000, max: 85_000 },
  watch: { min: 25_000, max: 350_000 },
  tv: { min: 80_000, max: 900_000 },
  freezer: { min: 120_000, max: 450_000 },
};

export function predictMarketPrice(input: {
  productTitle: string;
  category: string;
  description: string;
  currentPrice: number;
  /** Related listings count from GreenHub (optional). */
  relatedListingCount?: number;
}): MarketPricePredictionResult {
  const blob = `${input.productTitle}\n${input.category}\n${input.description}`.toLowerCase();
  const words = blob.split(/\s+/).filter(Boolean);

  let range: { min: number; max: number } | null = null;
  for (const [keyword, r] of Object.entries(KEYWORD_RANGES)) {
    if (words.includes(keyword) || blob.includes(keyword)) {
      range = r;
      break;
    }
  }

  if (!range) {
    const p = input.currentPrice;
    const safe = Number.isFinite(p) && p > 0 ? p : 50_000;
    range = {
      min: Math.round(safe * 0.85),
      max: Math.round(safe * 1.15),
    };
  }

  const h = hashString(blob);
  const jitter = 3 + (h % 9);
  const baseRelated = typeof input.relatedListingCount === "number" ? input.relatedListingCount : 0;
  const similarItemCount = Math.min(60, Math.max(8, baseRelated + jitter));

  return {
    min: range.min,
    max: range.max,
    similarItemCount,
  };
}
