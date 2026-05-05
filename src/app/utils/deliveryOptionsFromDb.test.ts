import { describe, expect, it } from "vitest";
import { parseDeliveryOptionsFromDb } from "./deliveryOptionsFromDb";

describe("parseDeliveryOptionsFromDb", () => {
  it("parses text[] JSON string elements with fee", () => {
    const out = parseDeliveryOptionsFromDb(['{"name":"Seller delivery","fee":800}']);
    expect(out[0]).toEqual(expect.objectContaining({ name: "Seller delivery", fee: 800 }));
  });
});
