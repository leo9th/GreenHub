import { captureCheckoutException, type CheckoutFailureStep } from "../../lib/sentry";
import type { MarketMode } from "../config/commercePolicy";

export type PaystackReference = { reference?: string };

export type CreateOrderForPaystackParams = {
  orderStatus: "paid" | "needs_review";
  paymentReference: string | null;
  paymentChannel: "paystack";
};

type CheckoutUser = { id: string } | null;

type OrderRecord = { id: string };

type PaystackSuccessDependencies = {
  user: CheckoutUser;
  createOrderWithLineItemsAndPlacedEvent: (
    params: CreateOrderForPaystackParams,
  ) => Promise<OrderRecord>;
  clearCart: () => void;
  navigate: (path: string) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  logError?: (error: unknown) => void;
  marketMode: MarketMode;
};

export function createPaystackSuccessHandler({
  user,
  createOrderWithLineItemsAndPlacedEvent,
  clearCart,
  navigate,
  notifySuccess,
  notifyError,
  logError,
  marketMode,
}: PaystackSuccessDependencies) {
  return async (reference: PaystackReference) => {
    let failedStep: CheckoutFailureStep = "Paystack Initialization";
    try {
      if (!user) {
        notifyError("You must be logged in to complete this order.");
        captureCheckoutException(new Error("Missing authenticated user during Paystack checkout."), failedStep, {
          hasUser: false,
          paymentReference: reference?.reference ?? null,
          market_mode: marketMode,
          payment_channel: "paystack",
        });
        return;
      }

      failedStep = "Paystack Order Creation";

      const orderData = await createOrderWithLineItemsAndPlacedEvent({
        orderStatus: "paid",
        paymentReference: reference?.reference ?? null,
        paymentChannel: "paystack",
      });

      notifySuccess("Payment successful! Your order has been placed.");
      clearCart();
      navigate(`/orders/${orderData.id}`);
    } catch (err: unknown) {
      captureCheckoutException(err, failedStep, {
        hasUser: Boolean(user),
        paymentReference: reference?.reference ?? null,
        market_mode: marketMode,
        payment_channel: "paystack",
      });
      logError?.(err);
      notifyError(
        `Payment was received, but we could not finalize your order. Please contact support with reference ${reference?.reference ?? "N/A"}.`,
      );
    }
  };
}
