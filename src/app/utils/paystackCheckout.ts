import { captureCheckoutException, type CheckoutFailureStep } from "../../lib/sentry";
import type { MarketMode } from "../config/commercePolicy";
import {
  CHECKOUT_TOTAL_MISMATCH_HINT,
  CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE,
  isCheckoutTotalMismatchMessage,
} from "./checkoutOrderError";
import { supabaseErrorMessage } from "./supabaseErrorMessage";

export type PaystackReference = { reference?: string };

type CheckoutUser = { id: string } | null;

type OrderRecord = { id: string };

type PaystackSuccessDependencies = {
  user: CheckoutUser;
  /** Server verifies Paystack, then creates or returns existing order (idempotent by payment_reference). */
  finalizePaidPaystackOrder: (paymentReference: string) => Promise<OrderRecord>;
  clearCart: () => void;
  navigate: (path: string) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string, options?: { description?: string }) => void;
  logError?: (error: unknown) => void;
  marketMode: MarketMode;
};

export function createPaystackSuccessHandler({
  user,
  finalizePaidPaystackOrder,
  clearCart,
  navigate,
  notifySuccess,
  notifyError,
  logError,
  marketMode,
}: PaystackSuccessDependencies) {
  return async (reference: PaystackReference) => {
    let failedStep: CheckoutFailureStep = "Paystack Initialization";
    const paymentRef = String(reference?.reference ?? "").trim();
    try {
      if (!user) {
        notifyError("You must be logged in to complete this order.");
        captureCheckoutException(new Error("Missing authenticated user during Paystack checkout."), failedStep, {
          hasUser: false,
          paymentReference: paymentRef || null,
          market_mode: marketMode,
          payment_channel: "paystack",
        });
        return;
      }

      if (!paymentRef) {
        failedStep = "Paystack Initialization";
        notifyError("Missing payment reference. Please contact support if you were charged.");
        captureCheckoutException(new Error("Paystack onSuccess without reference."), failedStep, {
          hasUser: true,
          paymentReference: null,
          market_mode: marketMode,
          payment_channel: "paystack",
        });
        return;
      }

      failedStep = "Paystack Server Verification";

      const orderData = await finalizePaidPaystackOrder(paymentRef);

      notifySuccess("Payment successful! Your order has been placed.");
      clearCart();
      navigate(`/orders/${orderData.id}`);
    } catch (err: unknown) {
      captureCheckoutException(err, failedStep, {
        hasUser: Boolean(user),
        paymentReference: paymentRef || null,
        market_mode: marketMode,
        payment_channel: "paystack",
      });
      logError?.(err);
      const raw = supabaseErrorMessage(err, "");
      if (isCheckoutTotalMismatchMessage(raw)) {
        notifyError(CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE, {
          description: `${CHECKOUT_TOTAL_MISMATCH_HINT} If payment completed, keep your Paystack reference (${paymentRef || "N/A"}) for support.`,
        });
      } else {
        notifyError(
          `Payment was received, but we could not finalize your order. Please contact support with reference ${paymentRef || "N/A"}.`,
        );
      }
    }
  };
}
