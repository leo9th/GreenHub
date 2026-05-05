import { describe, expect, it } from "vitest";
import {
  isProductRowPurchasableForCart,
  reconcileCartLines,
  type CartReconcileLine,
} from "./cartReconcile";

const baseLine = (over: Partial<CartReconcileLine> = {}): CartReconcileLine => ({
  id: "p1",
  title: "Old",
  price: 100,
  image: "https://x/a.jpg",
  quantity: 2,
  sellerId: "s1",
  deliveryFee: 500,
  fulfillment_type: "seller_pickup",
  ...over,
});

describe("isProductRowPurchasableForCart", () => {
  it("returns false for missing row", () => {
    expect(isProductRowPurchasableForCart(undefined)).toBe(false);
    expect(isProductRowPurchasableForCart(null)).toBe(false);
  });

  it("requires active status", () => {
    expect(
      isProductRowPurchasableForCart({
        id: "p1",
        status: "active",
        stock_quantity: 3,
      } as Record<string, unknown>),
    ).toBe(true);
    expect(
      isProductRowPurchasableForCart({
        id: "p1",
        status: "sold",
        stock_quantity: 3,
      } as Record<string, unknown>),
    ).toBe(false);
  });

  it("rejects known zero stock", () => {
    expect(
      isProductRowPurchasableForCart({
        id: "p1",
        status: "active",
        stock_quantity: 0,
      } as Record<string, unknown>),
    ).toBe(false);
  });

  it("allows unknown stock for active listings", () => {
    expect(
      isProductRowPurchasableForCart({
        id: "p1",
        status: "active",
      } as Record<string, unknown>),
    ).toBe(true);
    expect(
      isProductRowPurchasableForCart({
        id: "p1",
        status: "active",
        stock_quantity: null,
      } as Record<string, unknown>),
    ).toBe(true);
  });
});

describe("reconcileCartLines", () => {
  it("updates price and delivery from product row", () => {
    const row = {
      id: "p1",
      title: "New title",
      price: 200,
      price_local: 200,
      status: "active",
      stock_quantity: 10,
      seller_id: "s1",
      fulfillment_type: "seller_pickup",
      delivery_options: ['{"name":"Seller delivery","fee":800}'],
      image: "https://x/b.jpg",
      images: [],
    };
    const { next, removedCount, adjustedCount, updatedCount } = reconcileCartLines([baseLine()], [row]);
    expect(removedCount).toBe(0);
    expect(adjustedCount).toBe(0);
    expect(updatedCount).toBe(1);
    expect(next).toHaveLength(1);
    expect(next[0]?.title).toBe("New title");
    expect(next[0]?.price).toBe(200);
    expect(next[0]?.deliveryFee).toBe(800);
    expect(next[0]?.quantity).toBe(2);
  });

  it("removes missing or unpurchasable products", () => {
    const { next, removedCount } = reconcileCartLines([baseLine()], []);
    expect(removedCount).toBe(1);
    expect(next).toHaveLength(0);
  });

  it("removes sold-out (stock 0)", () => {
    const row = {
      id: "p1",
      title: "X",
      price: 1,
      price_local: 1,
      status: "active",
      stock_quantity: 0,
      seller_id: "s1",
      delivery_options: [],
    };
    const { next, removedCount } = reconcileCartLines([baseLine()], [row]);
    expect(removedCount).toBe(1);
    expect(next).toHaveLength(0);
  });

  it("clamps quantity to stock", () => {
    const row = {
      id: "p1",
      title: "X",
      price: 1,
      price_local: 1,
      status: "active",
      stock_quantity: 1,
      seller_id: "s1",
      delivery_options: [],
    };
    const { next, adjustedCount } = reconcileCartLines([baseLine({ quantity: 5 })], [row]);
    expect(adjustedCount).toBe(1);
    expect(next[0]?.quantity).toBe(1);
  });

  it("drops inactive status", () => {
    const row = {
      id: "p1",
      title: "X",
      price: 1,
      price_local: 1,
      status: "sold",
      stock_quantity: 1,
      seller_id: "s1",
    };
    const { removedCount, next } = reconcileCartLines([baseLine()], [row]);
    expect(removedCount).toBe(1);
    expect(next).toHaveLength(0);
  });
});
