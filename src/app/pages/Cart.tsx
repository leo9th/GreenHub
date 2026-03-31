import { Link, useNavigate } from "react-router";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { useCart } from "../context/CartContext";

export default function Cart() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  
  const { items: cartItems, updateQuantity, removeFromCart } = useCart();

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalDelivery = cartItems.reduce((sum, item) => sum + item.deliveryFee, 0);
  const platformFee = Math.round(subtotal * 0.10); // 10% platform fee
  const total = subtotal + totalDelivery + platformFee;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Shopping Cart</h1>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center px-4 py-32">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 text-center mb-8 max-w-xs">
            Looks like you haven't added anything to your cart yet.
          </p>
          <Link
            to="/products"
            className="px-8 py-3.5 bg-[#22c55e] text-white rounded-full font-semibold shadow-sm hover:bg-[#16a34a] hover:-translate-y-0.5 transition-all"
          >
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Shopping Cart</h1>
          <span className="ml-auto text-sm text-[#22c55e] bg-[#22c55e]/10 px-3 py-1 rounded-full font-semibold">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </header>

      {/* Cart Items */}
      <div className="px-4 py-6 max-w-7xl mx-auto md:grid md:grid-cols-3 md:gap-8 md:items-start">
        <div className="md:col-span-2 space-y-4">
        {cartItems.map((item) => (
          <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex gap-4 mb-4">
              <Link to={`/products/${item.id}`} className="w-24 h-24 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0 py-1">
                <Link to={`/products/${item.id}`}>
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 hover:text-[#22c55e] transition-colors">{item.title}</h3>
                </Link>
                <p className="text-lg font-bold text-gray-900 mb-2">{formatPrice(item.price)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-red-500 flex items-center gap-1.5 text-sm font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
              
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-200 p-0.5">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-semibold text-gray-800 w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Delivery fee:</span>
                <span className="font-medium text-gray-700">{formatPrice(item.deliveryFee)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Continue Shopping */}
        <Link
          to="/products"
          className="flex items-center justify-center w-full py-4 text-center text-[#22c55e] font-semibold hover:bg-[#22c55e]/5 rounded-xl transition-colors border-2 border-dashed border-[#22c55e]/30 mt-4"
        >
          + Continue Shopping
        </Link>
        </div>

      {/* Bottom Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-30 md:static md:block md:border md:border-gray-200 md:rounded-xl md:top-24 md:sticky md:p-6 md:shadow-sm mt-6">
        <div className="px-5 py-5 max-w-7xl mx-auto md:p-0">
          <h2 className="hidden md:block text-lg font-bold text-gray-900 mb-5 pb-4 border-b border-gray-100">Order Summary</h2>
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Delivery fees</span>
              <span className="font-medium text-gray-800">{formatPrice(totalDelivery)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Platform fee (10%)</span>
              <span className="font-medium text-gray-800">{formatPrice(platformFee)}</span>
            </div>
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-200">
              <span className="font-bold text-gray-900 text-lg">Total</span>
              <span className="text-2xl font-bold text-[#22c55e]">{formatPrice(total)}</span>
            </div>
          </div>
          <Link
            to="/checkout"
            className="block w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] hover:-translate-y-0.5 transition-all text-white rounded-xl font-bold text-center shadow-md shadow-[#22c55e]/25"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
