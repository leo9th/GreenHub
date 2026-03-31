import { Link } from "react-router";
import { ProductCard } from "../components/cards/ProductCard";
import { SellerCard } from "../components/cards/SellerCard";
import { OrderCard } from "../components/cards/OrderCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Home, Search, Camera, Heart, MessageSquare, ShoppingBag, MapPin, CheckCircle2, Truck, Clock, ShieldCheck, ChevronRight } from "lucide-react";

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg p-6 mb-4">
        <h1 className="mb-2">GreenHub Design System</h1>
        <Link to="/" className="text-[#22c55e]">← Back to Home</Link>
      </div>

      {/* Screen Navigation */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">All Screens & Pages</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NavLink to="/" label="🏠 Homepage" />
          <NavLink to="/login" label="🔐 Login" />
          <NavLink to="/register" label="📝 Register" />
          <NavLink to="/verify-otp" label="📱 Verify OTP" />
          <NavLink to="/products" label="🔍 Products" />
          <NavLink to="/products/1" label="📦 Product Detail" />
          <NavLink to="/cart" label="🛒 Cart" />
          <NavLink to="/checkout" label="💳 Checkout" />
          <NavLink to="/orders" label="📋 Orders" />
          <NavLink to="/orders/1" label="📄 Order Detail" />
          <NavLink to="/messages" label="💬 Messages" />
          <NavLink to="/messages/1" label="💭 Chat" />
          <NavLink to="/seller/dashboard" label="📊 Seller Dashboard" />
          <NavLink to="/seller/products" label="🏪 Seller Products" />
          <NavLink to="/seller/products/new" label="➕ Add Product" />
          <NavLink to="/seller/bank-details" label="🏦 Bank Details" />
          <NavLink to="/reviews/1" label="⭐ Write Review" />
          <NavLink to="/seller/1/reviews" label="📝 Seller Reviews" />
          <NavLink to="/profile" label="👤 Profile" />
          <NavLink to="/settings" label="⚙️ Settings" />
          <NavLink to="/admin/dashboard" label="👨‍💼 Admin Dashboard" />
          <NavLink to="/admin/users" label="👥 Admin Users" />
          <NavLink to="/admin/products" label="📦 Admin Products" />
        </div>
      </section>

      {/* Colors */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Brand Colors</h2>
        <div className="grid grid-cols-3 gap-4">
          <ColorSwatch color="#22c55e" name="Primary Green" />
          <ColorSwatch color="#16a34a" name="Primary Dark" />
          <ColorSwatch color="#86efac" name="Primary Light" />
          <ColorSwatch color="#eab308" name="Secondary Yellow" />
          <ColorSwatch color="#ca8a04" name="Secondary Dark" />
          <ColorSwatch color="#ef4444" name="Error" />
          <ColorSwatch color="#f97316" name="Warning" />
          <ColorSwatch color="#3b82f6" name="Info" />
          <ColorSwatch color="#22c55e" name="Success" />
        </div>

        <h3 className="mt-6 mb-4">Gray Scale</h3>
        <div className="grid grid-cols-5 gap-4">
          <ColorSwatch color="#f9fafb" name="Gray 50" />
          <ColorSwatch color="#f3f4f6" name="Gray 100" />
          <ColorSwatch color="#e5e7eb" name="Gray 200" />
          <ColorSwatch color="#d1d5db" name="Gray 300" />
          <ColorSwatch color="#9ca3af" name="Gray 400" />
          <ColorSwatch color="#6b7280" name="Gray 500" />
          <ColorSwatch color="#4b5563" name="Gray 600" />
          <ColorSwatch color="#374151" name="Gray 700" />
          <ColorSwatch color="#1f2937" name="Gray 800" />
          <ColorSwatch color="#111827" name="Gray 900" />
        </div>
      </section>

      {/* Typography */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Typography</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">H1 - 32px / Bold</p>
            <h1>The quick brown fox jumps</h1>
          </div>
          <div>
            <p className="text-sm text-gray-500">H2 - 24px / Semibold</p>
            <h2>The quick brown fox jumps</h2>
          </div>
          <div>
            <p className="text-sm text-gray-500">H3 - 20px / Semibold</p>
            <h3>The quick brown fox jumps</h3>
          </div>
          <div>
            <p className="text-sm text-gray-500">Body - 14px / Regular</p>
            <p>The quick brown fox jumps over the lazy dog</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Body Small - 12px / Regular</p>
            <p className="text-xs">The quick brown fox jumps over the lazy dog</p>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Buttons</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">Primary Button</p>
            <button className="bg-[#22c55e] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#16a34a] transition-colors">
              Primary Button
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Secondary Button</p>
            <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors">
              Secondary Button
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Outline Button</p>
            <button className="border-2 border-[#22c55e] text-[#22c55e] px-6 py-3 rounded-lg font-medium hover:bg-[#22c55e] hover:text-white transition-colors">
              Outline Button
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Danger Button</p>
            <button className="bg-[#ef4444] text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors">
              Danger Button
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Small Buttons</p>
            <div className="flex gap-2">
              <button className="bg-[#22c55e] text-white px-4 py-2 rounded-lg text-sm font-medium">Small Primary</button>
              <button className="border border-[#22c55e] text-[#22c55e] px-4 py-2 rounded-lg text-sm font-medium">Small Outline</button>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Disabled Button</p>
            <button disabled className="bg-gray-300 text-gray-500 px-6 py-3 rounded-lg font-medium cursor-not-allowed">
              Disabled Button
            </button>
          </div>
        </div>
      </section>

      {/* Input Fields */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Input Fields</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Input</label>
            <input
              type="text"
              placeholder="Enter text here..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">With Helper Text</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">We'll never share your email with anyone else.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Error State</label>
            <input
              type="text"
              placeholder="Invalid input..."
              className="w-full px-4 py-3 border-2 border-[#ef4444] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ef4444]"
            />
            <p className="text-xs text-[#ef4444] mt-1">This field is required.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disabled Input</label>
            <input
              type="text"
              placeholder="Disabled..."
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          <div>
            <p className="text-sm text-gray-500 mb-2">Product Card</p>
            <ProductCard 
              image="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop"
              condition="Like New"
              title="iPhone 13 Pro Max - 256GB - Sierra Blue"
              price={650000}
              location="Ikeja, Lagos"
              rating={4.8}
              deliveryFee={2500}
            />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Seller Card</p>
            <SellerCard 
              name="James Adekunle"
              rating={4.8}
              totalReviews={234}
              totalSales={45}
              isVerified={true}
            />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Order Card</p>
            <OrderCard 
              orderNumber="GRN-ABC123"
              date="Dec 15, 2024"
              productImage="https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop"
              productTitle="Nike Air Max"
              price={65000}
              quantity={1}
              status="Delivered"
            />
          </div>
        </div>
      </section>

      {/* Badges */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Badges</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">Condition Badges</p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-[#22c55e] text-white px-3 py-1 rounded text-sm">New</span>
              <span className="bg-[#86efac] text-gray-800 px-3 py-1 rounded text-sm">Like New</span>
              <span className="bg-[#eab308] text-white px-3 py-1 rounded text-sm">Good</span>
              <span className="bg-gray-400 text-white px-3 py-1 rounded text-sm">Fair</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Status Badges</p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-[#22c55e] text-white px-3 py-1 rounded-full text-sm">Active</span>
              <span className="bg-[#3b82f6] text-white px-3 py-1 rounded-full text-sm">Processing</span>
              <span className="bg-[#f97316] text-white px-3 py-1 rounded-full text-sm">Shipped</span>
              <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm">Sold</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Special Badges</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-sm font-medium">
                <Truck className="w-3.5 h-3.5" />
                Fast Delivery
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Tabs</h2>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Horizontal Tabs</p>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none mb-4 h-auto p-0 bg-transparent flex gap-4 overflow-x-auto">
                <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-[#22c55e] data-[state=active]:text-[#22c55e] data-[state=active]:shadow-none rounded-none py-2 px-1 bg-transparent">All Items</TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-[#22c55e] data-[state=active]:text-[#22c55e] data-[state=active]:shadow-none rounded-none py-2 px-1 bg-transparent">Pending</TabsTrigger>
                <TabsTrigger value="shipped" className="data-[state=active]:border-b-2 data-[state=active]:border-[#22c55e] data-[state=active]:text-[#22c55e] data-[state=active]:shadow-none rounded-none py-2 px-1 bg-transparent">Shipped</TabsTrigger>
                <TabsTrigger value="delivered" className="data-[state=active]:border-b-2 data-[state=active]:border-[#22c55e] data-[state=active]:text-[#22c55e] data-[state=active]:shadow-none rounded-none py-2 px-1 bg-transparent">Delivered</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Pill Tabs (Categories)</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button className="whitespace-nowrap bg-[#22c55e] text-white px-4 py-2 rounded-full text-sm font-medium">All Categories</button>
              <button className="whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-medium transition-colors">📱 Electronics</button>
              <button className="whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-medium transition-colors">👕 Fashion</button>
              <button className="whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-medium transition-colors">🚗 Vehicles</button>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Modals</h2>
        <div className="flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Confirm Modal</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-gray-600">Are you sure you want to delete this item? This action cannot be undone.</p>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive" className="bg-[#ef4444]">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Icons */}
      <section className="bg-white rounded-lg p-6 mb-4">
        <h2 className="mb-4">Common Icons</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          <div className="flex flex-col items-center gap-2"><Home className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Home</span></div>
          <div className="flex flex-col items-center gap-2"><Search className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Search</span></div>
          <div className="flex flex-col items-center gap-2"><Camera className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Sell</span></div>
          <div className="flex flex-col items-center gap-2"><MessageSquare className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Messages</span></div>
          <div className="flex flex-col items-center gap-2"><ShoppingBag className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Bag</span></div>
          <div className="flex flex-col items-center gap-2"><Heart className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Heart</span></div>
          <div className="flex flex-col items-center gap-2"><MapPin className="w-6 h-6 text-gray-600" /><span className="text-xs text-gray-500">Location</span></div>
          <div className="flex flex-col items-center gap-2"><ShieldCheck className="w-6 h-6 text-[#22c55e]" /><span className="text-xs text-gray-500">Trust</span></div>
        </div>
      </section>
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-4 py-2 bg-gray-100 hover:bg-[#22c55e] hover:text-white rounded-lg text-sm transition-colors text-center"
    >
      {label}
    </Link>
  );
}

function ColorSwatch({ color, name }: { color: string; name: string }) {
  return (
    <div>
      <div className="w-full h-16 rounded-lg border border-gray-200" style={{ backgroundColor: color }}></div>
      <p className="text-xs text-gray-600 mt-2">{name}</p>
      <p className="text-xs text-gray-400">{color}</p>
    </div>
  );
}
