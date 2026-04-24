import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart, type CartItem } from "./CartContext";

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("CartProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("merges duplicate cart items and keeps totals correct", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const firstAdd: CartItem = {
      id: "sku-1",
      title: "Phone",
      price: 250000,
      image: "https://example.com/phone.jpg",
      quantity: 1,
      sellerId: "seller-1",
      deliveryFee: 5000,
      fulfillment_type: "warehouse_shipping",
    };

    act(() => {
      result.current.addToCart(firstAdd);
      result.current.addToCart({ ...firstAdd, quantity: 2, deliveryFee: 6000 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.quantity).toBe(3);
    expect(result.current.items[0]?.deliveryFee).toBe(6000);
    expect(result.current.cartCount).toBe(3);
    expect(result.current.cartTotal).toBe(750000);
  });
});
