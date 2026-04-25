import { commercePolicy } from "../config/commercePolicy";
import type { CheckoutBlockedReason } from "./checkoutRisk";

export type StuckUserAssist = {
  blockedReason: CheckoutBlockedReason;
  userMessage: string;
  nextBestAction: string;
  fallbackAction: string;
};

const primarySupportChannel = commercePolicy.supportChannelPriority[0];

export function getStuckUserAssist(reason: CheckoutBlockedReason): StuckUserAssist {
  switch (reason) {
    case "auth_required":
      return {
        blockedReason: reason,
        userMessage: "Please sign in before continuing checkout.",
        nextBestAction: "Go to login",
        fallbackAction: "Contact support if login still fails.",
      };
    case "cart_empty":
      return {
        blockedReason: reason,
        userMessage: "Your cart is empty, so checkout cannot continue yet.",
        nextBestAction: "Return to products",
        fallbackAction: "Contact support if your cart items disappeared unexpectedly.",
      };
    case "payment_provider_unavailable":
      return {
        blockedReason: reason,
        userMessage: "Payments are temporarily unavailable right now.",
        nextBestAction: "Retry in a moment",
        fallbackAction: `Reach support via ${primarySupportChannel} if it keeps failing.`,
      };
    case "c2c_high_value_review":
      return {
        blockedReason: reason,
        userMessage: "This C2C order needs a quick trust review before payment.",
        nextBestAction: "Submit order for review",
        fallbackAction: `Reach support via ${primarySupportChannel} to speed up approval.`,
      };
    default:
      return {
        blockedReason: reason,
        userMessage: "This step needs attention before checkout can continue.",
        nextBestAction: "Retry",
        fallbackAction: `Reach support via ${primarySupportChannel}.`,
      };
  }
}
