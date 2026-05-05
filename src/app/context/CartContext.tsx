import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../../lib/supabase";
import { reconcileCartLines } from "../utils/cartReconcile";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  sellerId: string;
  deliveryFee: number;
  /** `warehouse_shipping` = GreenHub Guaranteed; `seller_pickup` = Marketplace. */
  fulfillment_type?: string | null;
}

function normalizeCartItem(raw: Record<string, unknown>): CartItem {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    price: typeof raw.price === "number" ? raw.price : Number(raw.price) || 0,
    image: String(raw.image ?? ""),
    quantity: typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity) || 1,
    sellerId: String(raw.sellerId ?? ""),
    deliveryFee: typeof raw.deliveryFee === "number" ? raw.deliveryFee : Number(raw.deliveryFee) || 0,
    fulfillment_type:
      typeof raw.fulfillment_type === "string" && raw.fulfillment_type.trim() !== ""
        ? raw.fulfillment_type
        : "seller_pickup",
  };
}

export type RefreshCartResult = {
  changed: boolean;
  removedCount: number;
  adjustedCount: number;
  updatedCount: number;
  /** True when the server fetch failed; cart state was not updated. */
  refreshFailed: boolean;
  /** True when the cart had lines before reconcile and none after (e.g. all unavailable). */
  cartBecameEmpty: boolean;
  /** Line count after a successful reconcile; on failure, count before refresh attempt. */
  itemCountAfter: number;
  /** Cart lines after reconcile when refresh succeeded; empty array if snapshot was empty. */
  itemsAfterRefresh: CartItem[];
};

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  refreshCart: () => Promise<RefreshCartResult>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("greenhub-cart");
    if (!saved) return [];
    try {
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((row) => normalizeCartItem(row as Record<string, unknown>));
    } catch {
      return [];
    }
  });

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    localStorage.setItem('greenhub-cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (newItem: CartItem) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === newItem.id);
      if (existing) {
        const normalized = normalizeCartItem({ ...newItem } as Record<string, unknown>);
        return current.map((item) =>
          item.id === newItem.id
            ? {
                ...item,
                quantity: item.quantity + normalized.quantity,
                title: normalized.title,
                price: normalized.price,
                image: normalized.image,
                sellerId: normalized.sellerId,
                deliveryFee: normalized.deliveryFee,
                fulfillment_type: normalized.fulfillment_type ?? item.fulfillment_type,
              }
            : item,
        );
      }
      return [...current, normalizeCartItem({ ...newItem } as Record<string, unknown>)];
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems(current => current.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems(current => 
      current.map(item => item.id === itemId ? { ...item, quantity } : item)
    );
  };

  const clearCart = () => setItems([]);

  const refreshCart = useCallback(async (): Promise<RefreshCartResult> => {
    const snapshot = itemsRef.current;
    if (snapshot.length === 0) {
      return {
        changed: false,
        removedCount: 0,
        adjustedCount: 0,
        updatedCount: 0,
        refreshFailed: false,
        cartBecameEmpty: false,
        itemCountAfter: 0,
        itemsAfterRefresh: [],
      };
    }
    const ids = [...new Set(snapshot.map((i) => i.id))];
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, price, price_local, image, images, seller_id, fulfillment_type, delivery_options, stock_quantity, status",
        )
        .in("id", ids);
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      const { next, removedCount, adjustedCount, updatedCount } = reconcileCartLines(snapshot, rows);
      const nextItems = next.map((row) => normalizeCartItem(row as Record<string, unknown>));
      const changed = removedCount > 0 || adjustedCount > 0 || updatedCount > 0 || next.length !== snapshot.length;
      if (changed) {
        setItems(nextItems);
        itemsRef.current = nextItems;
      }
      return {
        changed,
        removedCount,
        adjustedCount,
        updatedCount,
        refreshFailed: false,
        cartBecameEmpty: snapshot.length > 0 && next.length === 0,
        itemCountAfter: next.length,
        itemsAfterRefresh: nextItems,
      };
    } catch {
      return {
        changed: false,
        removedCount: 0,
        adjustedCount: 0,
        updatedCount: 0,
        refreshFailed: true,
        cartBecameEmpty: false,
        itemCountAfter: snapshot.length,
        itemsAfterRefresh: snapshot,
      };
    }
  }, []);

  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
