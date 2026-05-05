import { supabaseErrorMessage } from "./supabaseErrorMessage";

/** Known RPC messages from `buyer_cancel_order` — safe to show verbatim (no secrets). */
const KNOWN_PREFIXES = [
  "This order was not found.",
  "You can only cancel your own orders.",
  "This order cannot be cancelled at this stage.",
  "This order cannot be cancelled because one or more items have already shipped.",
  "This order cannot be cancelled because delivery is already in progress.",
];

/**
 * Maps Supabase / Postgres errors from buyer cancel RPC to a single user-facing line.
 * Unknown errors get a generic message (no raw hints/codes).
 */
export function formatBuyerCancelOrderError(error: unknown): string {
  const raw = supabaseErrorMessage(error, "").trim();
  if (!raw) return "Could not cancel this order. Please try again.";
  const primary = raw.split(/\s—\s/)[0]?.trim() ?? raw;
  if (KNOWN_PREFIXES.some((p) => primary === p || primary.startsWith(p))) return primary;
  return "Could not cancel this order. Please try again or contact support.";
}
