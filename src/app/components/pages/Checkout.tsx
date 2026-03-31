import { useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, MapPin, CreditCard, CheckCircle2 } from "lucide-react";

const nigerianStates = [
  "Lagos", "Abuja", "Kano", "Rivers", "Kaduna", "Oyo", "Edo", "Delta",
  "Ogun", "Enugu", "Anambra", "Imo", "Kwara", "Plateau", "Benue",
];

const cartItems = [
  {
    id: 1,
    name: "iPhone 14 Pro Max 256GB",
    price: 850000,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200",
  },
  {
    id: 2,
    name: "Nike Air Max Sneakers",
    price: 45000,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
  },
];

export function Checkout() {
  const [selectedDelivery, setSelectedDelivery] = useState("gigl");
  const [paymentMethod, setPaymentMethod] = useState("card");

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = selectedDelivery === "pickup" ? 0 : 3500;
  const total = subtotal + deliveryFee;

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen pb-32">
      <div className="sticky top-0 bg-white border-b border-border p-4 flex items-center z-10">
        <Link to="/" className="text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg ml-3 text-foreground">Checkout</h1>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-[#22c55e]" />
            <h2 className="text-foreground">Delivery Address</h2>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Full Name"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
            <input
              type="text"
              placeholder="Street Address"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
            <div className="grid grid-cols-2 gap-3">
              <select className="px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]">
                <option value="">Select State</option>
                {nigerianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="LGA"
                className="px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Delivery Method</h2>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="delivery"
                value="gigl"
                checked={selectedDelivery === "gigl"}
                onChange={(e) => setSelectedDelivery(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">GIGL Express Delivery</p>
                <p className="text-sm text-muted-foreground">1-2 business days</p>
              </div>
              <span className="text-[#22c55e]">₦3,500</span>
            </label>
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="delivery"
                value="sendy"
                checked={selectedDelivery === "sendy"}
                onChange={(e) => setSelectedDelivery(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">Sendy Standard</p>
                <p className="text-sm text-muted-foreground">2-3 business days</p>
              </div>
              <span className="text-[#22c55e]">₦2,500</span>
            </label>
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="delivery"
                value="pickup"
                checked={selectedDelivery === "pickup"}
                onChange={(e) => setSelectedDelivery(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">Pickup from Seller</p>
                <p className="text-sm text-muted-foreground">Available today</p>
              </div>
              <span className="text-[#22c55e]">Free</span>
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-[#22c55e]" />
            <h2 className="text-foreground">Payment Method</h2>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="payment"
                value="card"
                checked={paymentMethod === "card"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">Debit/Credit Card</p>
                <p className="text-sm text-muted-foreground">Secured by Paystack</p>
              </div>
              <img
                src="https://paystack.com/assets/img/logos/paystack-icon-blue.png"
                alt="Paystack"
                className="w-6 h-6"
              />
            </label>
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="payment"
                value="transfer"
                checked={paymentMethod === "transfer"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">Bank Transfer</p>
                <p className="text-sm text-muted-foreground">Direct bank transfer</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:border-[#22c55e]">
              <input
                type="radio"
                name="payment"
                value="delivery"
                checked={paymentMethod === "delivery"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-[#22c55e]"
              />
              <div className="flex-1">
                <p className="text-foreground">Pay on Delivery</p>
                <p className="text-sm text-muted-foreground">Cash or POS</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Order Summary</h2>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground line-clamp-2">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="text-[#22c55e]">₦{item.price.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Delivery Fee</span>
            <span>{deliveryFee === 0 ? "Free" : `₦${deliveryFee.toLocaleString()}`}</span>
          </div>
          <div className="flex justify-between text-lg text-foreground pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-[#22c55e]">₦{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 max-w-7xl mx-auto">
        <Link
          to="/orders"
          className="w-full py-3 bg-[#22c55e] text-white rounded-lg flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          Place Order (₦{total.toLocaleString()})
        </Link>
        <p className="text-center text-xs text-muted-foreground mt-2">
          By placing this order, you agree to our Terms & Conditions
        </p>
      </div>
    </div>
  );
}
