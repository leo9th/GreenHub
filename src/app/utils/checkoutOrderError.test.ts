import { describe, expect, it } from "vitest";
import {
  CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE,
  formatCheckoutOrderCreationError,
  isCheckoutTotalMismatchMessage,
} from "./checkoutOrderError";

describe("checkoutOrderError", () => {
  it("detects server total mismatch copy", () => {
    expect(isCheckoutTotalMismatchMessage("Order total mismatch. Please refresh cart and try again.")).toBe(true);
    expect(isCheckoutTotalMismatchMessage("ORDER TOTAL MISMATCH")).toBe(true);
    expect(isCheckoutTotalMismatchMessage("Insufficient stock")).toBe(false);
  });

  it("replaces mismatch with friendly checkout copy", () => {
    expect(
      formatCheckoutOrderCreationError(
        new Error("Order total mismatch. Please refresh cart and try again."),
        "fallback",
      ),
    ).toBe(CHECKOUT_TOTAL_MISMATCH_USER_MESSAGE);
  });

  it("passes through other errors via supabaseErrorMessage", () => {
    expect(formatCheckoutOrderCreationError(new Error("Out of stock"), "fallback")).toBe("Out of stock");
  });
});
