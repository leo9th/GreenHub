import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, CreditCard, Building2, Smartphone, Home } from "lucide-react";
import { nigerianStates } from "../data/catalogConstants";
import { getLGAsForState } from "../data/mockData";
import { useCurrency } from "../hooks/useCurrency";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { PaystackButton } from "react-paystack";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  computeHybridDeliveryTotals,
  isWarehouseShippingFulfillment,
} from "../utils/fulfillment";

export default function Checkout() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { items, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  
  const [step, setStep] = useState<"address" | "payment">("address");

  // Address form
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [state, setState] = useState(user?.user_metadata?.state || "");
  const [lga, setLga] = useState(user?.user_metadata?.lga || "");
  const [address, setAddress] = useState(user?.user_metadata?.address || "");
  const [landmark, setLandmark] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank" | "ussd" | "pod">("card");
  const [podSubmitting, setPodSubmitting] = useState(false);

  const subtotal = cartTotal;
  const { guaranteedFlat, marketplaceSellerFees, total: delivery } = computeHybridDeliveryTotals(items);
  const platformFee = Math.round(subtotal * 0.1);
  const total = subtotal + delivery + platformFee;

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }
    setStep("payment");
  };

  const createOrderWithLineItemsAndPlacedEvent = useCallback(
    async (params: {
      orderStatus: "paid" | "pending_payment";
      paymentReference: string | null;
      /** Stored on `orders.payment_method`: Paystack checkout vs pay on delivery */
      paymentChannel: "paystack" | "pod";
    }) => {
      if (!user) throw new Error("You must be logged in to complete this order.");

      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        buyer_id: user.id,
        total_amount: total,
        delivery_fee: delivery,
        platform_fee: platformFee,
        status: params.orderStatus,
        payment_reference: params.paymentReference,
        payment_method: params.paymentChannel,
        shipping_address: {
          fullName,
          phone,
          state,
          lga,
          address,
          landmark,
        },
      }).select().single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => {
        const unit = item.price;
        const qty = item.quantity;
        const fulfillment = item.fulfillment_type?.trim() || "seller_pickup";
        return {
          order_id: orderData.id,
          product_id: item.id,
          seller_id: item.sellerId || user.id,
          product_title: item.title,
          product_image: item.image,
          quantity: qty,
          unit_price: unit,
          total_price: unit * qty,
          price_at_time: unit,
          fulfillment_type: fulfillment,
          delivery_fee_at_time: item.deliveryFee,
          status: "pending" as const,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      const { error: eventError } = await supabase.from("order_events").insert({
        order_id: orderData.id,
        event_label: "Order Placed",
        metadata: { source: params.paymentChannel },
      });
      if (eventError) throw eventError;

      return orderData;
    },
    [user, items, total, delivery, platformFee, fullName, phone, state, lga, address, landmark],
  );

  const handlePODSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to complete this order.");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }
    setPodSubmitting(true);
    try {
      const orderData = await createOrderWithLineItemsAndPlacedEvent({
        orderStatus: "pending_payment",
        paymentReference: null,
        paymentChannel: "pod",
      });
      toast.success("Order placed! Pay on delivery when your order arrives.");
      clearCart();
      navigate(`/orders/${orderData.id}`);
    } catch (err: unknown) {
      console.error("POD order creation:", err);
      toast.error(err instanceof Error ? err.message : "Could not place your order.");
    } finally {
      setPodSubmitting(false);
    }
  };

  const paystackProps = {
    email: user?.email || "customer@greenhub.com",
    amount: total * 100, // in kobo
    metadata: {
      name: fullName,
      phone,
      custom_fields: [
        {
          display_name: "Items",
          variable_name: "items",
          value: items
            .map((item) =>
              `${item.title}${isWarehouseShippingFulfillment(item.fulfillment_type) ? " [Guaranteed]" : " [Marketplace]"}`,
            )
            .join(", "),
        },
      ]
    },
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    text: `Pay ${formatPrice(total)} Securely`,
    onSuccess: async (reference: { reference?: string }) => {
      try {
        if (!user) {
          toast.error("You must be logged in to complete this order.");
          return;
        }

        const orderData = await createOrderWithLineItemsAndPlacedEvent({
          orderStatus: "paid",
          paymentReference: reference?.reference ?? null,
          paymentChannel: "paystack",
        });

        toast.success("Payment successful! Your order has been placed.");
        clearCart();
        navigate(`/orders/${orderData.id}`);
      } catch (err: unknown) {
        console.error("Order Creation Error:", err);
        toast.success("Payment successful! Your order will be tracked shortly.");
        clearCart();
        navigate("/orders");
      }
    },
    onClose: () => {
      toast.error("Payment window closed. Your transaction was cancelled.");
    },
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-4xl">🛒</div>
        <h2 className="text-xl font-bold mb-3">Your cart is empty</h2>
        <p className="text-gray-500 mb-8 max-w-sm text-center">Add some products to your cart before proceeding to checkout.</p>
        <button onClick={() => navigate("/products")} className="px-8 py-3 bg-[#22c55e] text-white font-bold rounded-xl hover:bg-[#16a34a] transition-colors shadow-sm">
          Go Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => step === "payment" ? setStep("address") : navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Checkout</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white shadow-sm border-b border-gray-100 mb-6">
        <div className="px-6 py-5 max-w-7xl mx-auto">
          <div className="flex items-center justify-center max-w-md mx-auto">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step === "address" ? "bg-[#22c55e] text-white ring-4 ring-[#22c55e]/20" : "bg-[#22c55e] text-white"}`}>
                {step === "payment" ? <Check className="w-5 h-5" /> : "1"}
              </div>
              <p className={`text-xs font-semibold mt-2 ${step === "address" ? "text-[#22c55e]" : "text-gray-800"}`}>Address</p>
            </div>
            <div className={`w-24 h-1 mx-2 rounded-full transition-colors ${step === "payment" ? "bg-[#22c55e]" : "bg-gray-200"}`} />
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step === "payment" ? "bg-[#22c55e] text-white ring-4 ring-[#22c55e]/20" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                2
              </div>
              <p className={`text-xs font-semibold mt-2 ${step === "payment" ? "text-[#22c55e]" : "text-gray-500"}`}>Payment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-7xl mx-auto md:grid md:grid-cols-3 md:gap-8 md:items-start">
        <div className="md:col-span-2 space-y-6">
        {/* Address Step */}
        {step === "address" && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">📍</span>
              Delivery Details
            </h2>
            <form onSubmit={handleAddressSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]" placeholder="Enter recipient's full name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]" placeholder="08012345678" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">State</label>
                  <select value={state} onChange={(e) => { setState(e.target.value); setLga(""); }} required 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] bg-white">
                    <option value="">Select state...</option>
                    {nigerianStates.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">LGA</label>
                  <select value={lga} onChange={(e) => setLga(e.target.value)} required disabled={!state} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] disabled:bg-gray-50 bg-white">
                    <option value="">Select LGA...</option>
                    {getLGAsForState(state).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Street Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none" placeholder="House number and street name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Landmark (Optional)</label>
                <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]" placeholder="E.g., Beside total filling station" />
              </div>
              <button type="submit" className="w-full py-4 mt-6 bg-[#22c55e] text-white rounded-xl font-bold shadow-sm hover:bg-[#16a34a] transition-colors">
                Proceed to Payment
              </button>
            </form>
          </div>
        )}

        {/* Payment Step */}
        {step === "payment" && (
          <>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">💳</span>
                Select Payment Method
              </h2>
              <div className="space-y-3">
                <label className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "card" ? "border-[#22c55e] bg-[#22c55e]/5" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="payment" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} className="w-5 h-5 text-[#22c55e] focus:ring-[#22c55e]" />
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Card Payment</p>
                    <p className="text-sm text-gray-500">Pay securely with Debit/Credit Card</p>
                  </div>
                </label>

                <label className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "bank" ? "border-[#22c55e] bg-[#22c55e]/5" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="payment" checked={paymentMethod === "bank"} onChange={() => setPaymentMethod("bank")} className="w-5 h-5 text-[#22c55e]" />
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Bank Transfer</p>
                    <p className="text-sm text-gray-500">Direct transfer to virtual account</p>
                  </div>
                </label>

                <label className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "ussd" ? "border-[#22c55e] bg-[#22c55e]/5" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="payment" checked={paymentMethod === "ussd"} onChange={() => setPaymentMethod("ussd")} className="w-5 h-5 text-[#22c55e]" />
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">USSD Code</p>
                    <p className="text-sm text-gray-500">Dial unique code on your phone</p>
                  </div>
                </label>

                <label className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "pod" ? "border-[#22c55e] bg-[#22c55e]/5" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="payment" checked={paymentMethod === "pod"} onChange={() => setPaymentMethod("pod")} className="w-5 h-5 text-[#22c55e]" />
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Home className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Pay on Delivery</p>
                    <p className="text-sm text-gray-500">Cash or transfer when item arrives</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mt-4 opacity-70 mb-4">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">Secured By</span>
              <img src="https://paystack.com/assets/images/logo/logo.svg" alt="Paystack" className="h-4 grayscale opacity-80" />
            </div>
          </>
        )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:sticky md:top-24 mt-6 md:mt-0">
          <h2 className="text-lg font-bold text-gray-900 mb-5 pb-4 border-b border-gray-100">Order Summary</h2>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <img src={item.image} alt="" className="w-12 h-12 rounded bg-gray-50 object-cover border border-gray-100" />
                  <div>
                    <span className="text-sm font-medium text-gray-800 line-clamp-2">{item.title}</span>
                    <span className="text-xs text-gray-500 mt-1 block">Qty: {item.quantity}</span>
                  </div>
                </div>
                <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-gray-100 space-y-3 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-800">{formatPrice(subtotal)}</span>
              </div>
              {guaranteedFlat > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">GreenHub Guaranteed shipping (flat)</span>
                  <span className="font-medium text-gray-800">{formatPrice(guaranteedFlat)}</span>
                </div>
              ) : null}
              {items.some((i) => !isWarehouseShippingFulfillment(i.fulfillment_type)) ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Marketplace (seller)</span>
                  <span className="font-medium text-gray-800">
                    {marketplaceSellerFees > 0 ? formatPrice(marketplaceSellerFees) : "Pickup only"}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Delivery</span>
                <span className="font-medium text-gray-800">{formatPrice(delivery)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Platform Fee (10%)</span>
                <span className="font-medium text-gray-800">{formatPrice(platformFee)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-200">
                <span className="font-bold text-gray-900 text-lg">Total Amount</span>
                <span className="text-2xl font-bold text-[#22c55e]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      {step === "payment" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] px-4 py-4 z-50 md:static md:mt-8 md:border-none md:p-0 md:bg-transparent md:shadow-none">
          <div className="max-w-7xl mx-auto flex items-center justify-end">
            <div className="w-full md:w-auto md:min-w-[300px]">
              {paymentMethod === "pod" ? (
                <button
                  type="button"
                  disabled={podSubmitting}
                  onClick={() => void handlePODSubmit()}
                  className="w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:pointer-events-none text-white rounded-xl font-bold text-lg shadow-lg shadow-[#22c55e]/25 transition-all outline-none"
                >
                  {podSubmitting ? "Placing order…" : `Confirm Order (${formatPrice(total)})`}
                </button>
              ) : (
                <PaystackButton
                  {...paystackProps}
                  className="w-full py-4 bg-[#092b23] hover:bg-[#061d18] text-white rounded-xl font-bold text-lg shadow-lg shadow-[#092b23]/25 transition-all outline-none block text-center"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
