import { describe, expect, it } from "vitest";
import {
  decodeDomesticDeliveryFromRow,
  encodeDomesticDeliveryOptionsForDb,
} from "./sellerDomesticDeliveryOptions";

describe("sellerDomesticDeliveryOptions", () => {
  it("encodes delivery mode with fee as text[] JSON string", () => {
    const out = encodeDomesticDeliveryOptionsForDb("delivery", "1500");
    expect(out).toEqual([
      JSON.stringify({
        name: "Seller delivery",
        label: "Seller delivery",
        fee: 1500,
        duration: "",
      }),
    ]);
  });

  it("returns null for pickup", () => {
    expect(encodeDomesticDeliveryOptionsForDb("pickup", "500")).toBeNull();
  });

  it("returns null for invalid delivery fee", () => {
    expect(encodeDomesticDeliveryOptionsForDb("delivery", "")).toBeNull();
    expect(encodeDomesticDeliveryOptionsForDb("delivery", "0")).toBeNull();
  });

  it("decodes first text[] JSON element", () => {
    const arr = [
      JSON.stringify({
        name: "Seller delivery",
        label: "Seller delivery",
        fee: 2000,
        duration: "",
      }),
    ];
    expect(decodeDomesticDeliveryFromRow(arr)).toEqual({ mode: "delivery", feeNgn: 2000 });
  });

  it("decodes pickup when missing or zero fee", () => {
    expect(decodeDomesticDeliveryFromRow(null)).toEqual({ mode: "pickup", feeNgn: 0 });
    expect(decodeDomesticDeliveryFromRow([])).toEqual({ mode: "pickup", feeNgn: 0 });
    expect(decodeDomesticDeliveryFromRow([JSON.stringify({ name: "X", fee: 0 })])).toEqual({
      mode: "pickup",
      feeNgn: 0,
    });
  });
});
