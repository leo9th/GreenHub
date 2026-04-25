import { describe, expect, it, vi } from "vitest";
import { createPaystackSuccessHandler } from "./paystackCheckout";

describe("createPaystackSuccessHandler", () => {
  it("completes paid order flow and redirects to created order", async () => {
    const createOrderWithLineItemsAndPlacedEvent = vi.fn(async () => ({ id: "order-123" }));
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      createOrderWithLineItemsAndPlacedEvent,
      clearCart,
      navigate,
      notifySuccess,
      notifyError,
      logError,
      marketMode: "b2c",
    });

    await onSuccess({ reference: "pay-ref-1" });

    expect(createOrderWithLineItemsAndPlacedEvent).toHaveBeenCalledWith({
      orderStatus: "paid",
      paymentReference: "pay-ref-1",
      paymentChannel: "paystack",
    });
    expect(notifySuccess).toHaveBeenCalledWith("Payment successful! Your order has been placed.");
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/orders/order-123");
    expect(notifyError).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it("does not clear the cart when finalizing a paid order fails", async () => {
    const createOrderWithLineItemsAndPlacedEvent = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const clearCart = vi.fn();
    const navigate = vi.fn();
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const logError = vi.fn();

    const onSuccess = createPaystackSuccessHandler({
      user: { id: "user-1" },
      createOrderWithLineItemsAndPlacedEvent,
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
});
