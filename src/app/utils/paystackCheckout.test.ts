import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE } from "./checkoutOrderError";
import { createPaystackSuccessHandler } from "./paystackCheckout";

describe("createPaystackSuccessHandler", () => {
  it("completes paid order flow and redirects to created order", async () => {
    const finalizePaidPaystackOrder = vi.fn(async () => ({ id: "order-123" }));
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      finalizePaidPaystackOrder,
      clearCart,
      navigate,
      notifySuccess,
      notifyError,
      logError,
      marketMode: "b2c",
    });

    await onSuccess({ reference: "pay-ref-1" });

    expect(finalizePaidPaystackOrder).toHaveBeenCalledWith("pay-ref-1");
    expect(notifySuccess).toHaveBeenCalledWith("Payment successful! Your order has been placed.");
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/orders/order-123");
    expect(notifyError).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it("does not clear the cart when finalizing a paid order fails", async () => {
    const finalizePaidPaystackOrder = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      finalizePaidPaystackOrder,
      clearCart,
      navigate,
      notifySuccess,
      notifyError,
      logError,
      marketMode: "c2c",
    });

    await onSuccess({ reference: "pay-ref-2" });

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(
      "Payment was received, but we could not finalize your order. Please contact support with reference pay-ref-2.",
    );
    expect(clearCart).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("shows cart refresh message on order total mismatch after payment", async () => {
    const finalizePaidPaystackOrder = vi.fn(async () => {
      throw new Error("Order total mismatch. Please refresh cart and try again.");
    });
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      finalizePaidPaystackOrder,
      clearCart,
      navigate,
      notifySuccess,
      notifyError,
      logError,
      marketMode: "b2c",
    });

    await onSuccess({ reference: "pay-ref-mismatch" });

    expect(notifyError).toHaveBeenCalledWith(
      CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE,
      expect.objectContaining({
        description: expect.stringMatching(/Open your cart|Paystack reference/i),
      }),
    );
    expect(clearCart).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not finalize when Paystack reference is missing", async () => {
    const finalizePaidPaystackOrder = vi.fn(async () => ({ id: "order-x" }));
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      finalizePaidPaystackOrder,
      clearCart,
      navigate,
      notifySuccess,
      notifyError,
      logError,
      marketMode: "b2c",
    });

    await onSuccess({});

    expect(finalizePaidPaystackOrder).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalled();
  });
});
