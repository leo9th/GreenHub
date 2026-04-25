import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

function getTracesSampleRate() {
  const rawRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);
  if (Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1) {
    return rawRate;
  }
  return import.meta.env.DEV ? 1 : 0.1;
}

export function initSentry() {
  if (!sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: getTracesSampleRate(),
  });
}

export type CheckoutFailureStep =
  | "Paystack Initialization"
  | "Paystack Order Creation"
  | "Deliveries Table Insert"
  | "Pay On Delivery Order Creation"
  | "Checkout Render Boundary";

export function captureCheckoutException(
  error: unknown,
  step: CheckoutFailureStep,
  extras: Record<string, unknown> = {},
) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  Sentry.withScope((scope) => {
    scope.setTag("feature", "checkout");
    scope.setTag("checkout_step", step);
    if (typeof extras.market_mode === "string") {
      scope.setTag("market_mode", extras.market_mode);
    }
    if (typeof extras.payment_channel === "string") {
      scope.setTag("payment_channel", extras.payment_channel);
    }
    if (typeof extras.checkout_decision === "string") {
      scope.setTag("checkout_decision", extras.checkout_decision);
    }
    scope.setContext("checkout_context", extras);
    Sentry.captureException(normalizedError);
  });
}
