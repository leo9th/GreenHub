import { commercePolicy, type MarketMode } from "../config/commercePolicy";

export type CheckoutDecision = "allow" | "review" | "block";

export type CheckoutBlockedReason =
  | "auth_required"
  | "cart_empty"
  | "c2c_high_value_review"
  | "payment_provider_unavailable";

export type CheckoutRiskResult = {
  decision: CheckoutDecision;
  reason: CheckoutBlockedReason | null;
};

type EvaluateCheckoutRiskInput = {
  marketMode: MarketMode;
  orderValue: number;
  hasAuthenticatedUser: boolean;
  hasItems: boolean;
  paymentProviderReady: boolean;
};

export function evaluateCheckoutRisk(input: EvaluateCheckoutRiskInput): CheckoutRiskResult {
  if (!input.hasAuthenticatedUser) {
    return { decision: "block", reason: "auth_required" };
  }
  if (!input.hasItems) {
    return { decision: "block", reason: "cart_empty" };
  }
  if (!input.paymentProviderReady) {
    return { decision: "block", reason: "payment_provider_unavailable" };
  }
  if (input.marketMode === "c2c" && input.orderValue >= commercePolicy.c2cAutoReviewThresholdNgn) {
    return { decision: "review", reason: "c2c_high_value_review" };
  }
  return { decision: "allow", reason: null };
}
