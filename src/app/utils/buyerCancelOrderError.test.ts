import { describe, expect, it } from "vitest";
import { formatBuyerCancelOrderError } from "./buyerCancelOrderError";

describe("formatBuyerCancelOrderError", () => {
  it("passes through known RPC messages", () => {
    expect(formatBuyerCancelOrderError({ message: "This order cannot be cancelled at this stage." })).toBe(
      "This order cannot be cancelled at this stage.",
    );
  });

  it("strips appended hint segments before matching", () => {
    expect(
      formatBuyerCancelOrderError({
        message: "This order was not found. — Detail: xyz",
      }),
    ).toBe("This order was not found.");
  });

  it("returns generic message for unknown errors", () => {
    expect(formatBuyerCancelOrderError({ message: "relation secret_table does not exist" })).toBe(
      "Could not cancel this order. Please try again or contact support.",
    );
  });
});
