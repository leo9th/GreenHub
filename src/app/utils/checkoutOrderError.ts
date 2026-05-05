import { supabaseErrorMessage } from "./supabaseErrorMessage";

/** Shown when server-side totals (RPC) disagree with the client cart. */
export const CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE =
  "Some prices or delivery fees changed. Please refresh your cart and try again.";

/** Optional hint under the main toast (cart link lives in the app chrome). */
export const CHECKOUT_TOTAL_MISMATCH_HINT =
  "Open your cart to reload items, or browse products for updated prices.";

export function isCheckoutTotalMismatchMessage(raw: string): boolean {
  const s = raw.toLowerCase();
  return s.includes("order total mismatch") || s.includes("refresh cart and try again");
}

/**
 * Maps Supabase / Error payloads to a checkout-safe string, softening known total-mismatch RPC errors.
 */
export function formatCheckoutOrderCreationError(error: unknown, fallback: string): string {
  const raw = supabaseErrorMessage(error, fallback);
  if (isCheckoutTotalMismatchMessage(raw)) {
    return CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE;
  }
  return raw || fallback;
}
