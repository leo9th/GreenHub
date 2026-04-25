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
    // #region agent log
    void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
      body: JSON.stringify({
        sessionId: "35665f",
        runId: "run1",
        hypothesisId: "H2",
        location: "paystackCheckout.ts:onSuccess:start",
        message: "Paystack success handler invoked",
        data: { hasUser: Boolean(user), paymentReference: reference?.reference ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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
      // #region agent log
      void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
        body: JSON.stringify({
          sessionId: "35665f",
          runId: "run1",
          hypothesisId: "H1",
          location: "paystackCheckout.ts:onSuccess:before-order",
          message: "Finalizing Paystack order via RPC",
          data: { paymentReference: reference?.reference ?? null },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      const orderData = await createOrderWithLineItemsAndPlacedEvent({
        orderStatus: "paid",
        paymentReference: reference?.reference ?? null,
        paymentChannel: "paystack",
      });

      notifySuccess("Payment successful! Your order has been placed.");
      clearCart();
      navigate(`/orders/${orderData.id}`);
      // #region agent log
      void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
        body: JSON.stringify({
          sessionId: "35665f",
          runId: "run1",
          hypothesisId: "H1",
          location: "paystackCheckout.ts:onSuccess:order-success",
          message: "Paystack order finalized successfully",
          data: { orderId: orderData.id },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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
      // #region agent log
      void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
        body: JSON.stringify({
          sessionId: "35665f",
          runId: "run1",
          hypothesisId: failedStep === "Paystack Initialization" ? "H2" : "H1",
          location: "paystackCheckout.ts:onSuccess:catch",
          message: "Paystack success handler failed",
          data: {
            failedStep,
            hasUser: Boolean(user),
            paymentReference: reference?.reference ?? null,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  };
}
