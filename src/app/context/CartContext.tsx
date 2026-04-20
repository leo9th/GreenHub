import { createContext, useContext, useState, useEffect } from 'react';

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

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
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

  useEffect(() => {
    localStorage.setItem('greenhub-cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (newItem: CartItem) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === newItem.id);
      if (existing) {
        return current.map((item) =>
          item.id === newItem.id
            ? {
                ...item,
                quantity: item.quantity + newItem.quantity,
                fulfillment_type: newItem.fulfillment_type ?? item.fulfillment_type,
                deliveryFee: newItem.deliveryFee,
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

  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}>
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
