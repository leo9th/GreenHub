import { describe, expect, it } from "vitest";
import { evaluateCheckoutRisk } from "./checkoutRisk";

describe("evaluateCheckoutRisk", () => {
  it("returns review for high-value C2C orders", () => {
    const result = evaluateCheckoutRisk({
      marketMode: "c2c",
      orderValue: 300000,
      hasAuthenticatedUser: true,
      hasItems: true,
      paymentProviderReady: true,
    });

    expect(result).toEqual({
      decision: "review",
      reason: "c2c_high_value_review",
    });
  });

  it("returns allow for low-value B2C orders", () => {
    const result = evaluateCheckoutRisk({
      marketMode: "b2c",
      orderValue: 50000,
      hasAuthenticatedUser: true,
      hasItems: true,
      paymentProviderReady: true,
    });

    expect(result).toEqual({
      decision: "allow",
      reason: null,
    });
  });
});
