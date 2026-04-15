/** NetworkInformation is not in all TS lib.dom versions */
type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g" | undefined;

/**
 * Smaller listing batches on very slow connections to reduce payload and image decode work.
 */
export function getAdaptiveListingPageSize(basePageSize: number): number {
  if (typeof navigator === "undefined") return basePageSize;
  const conn = (navigator as Navigator & { connection?: { effectiveType?: EffectiveConnectionType } }).connection;
  const et = conn?.effectiveType;
  if (et === "slow-2g" || et === "2g") {
    if (basePageSize <= 10) return 5;
    return Math.max(5, Math.floor(basePageSize / 2));
  }
  return basePageSize;
}
