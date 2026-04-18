import { Link } from "react-router";
import { User, Settings, ShoppingBag, Heart, MapPin, Bell, HelpCircle, LogOut, ChevronRight, Shield, CreditCard } from "lucide-react";

export function Profile() {
  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
            <span className="text-3xl text-[#22c55e]">JD</span>
          </div>
          <div>
            <h1 className="text-2xl mb-1">John Doe</h1>
            <p className="text-sm opacity-90">john.doe@email.com</p>
            <p className="text-sm opacity-90">+234 801 234 5678</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 bg-white/20 rounded-lg p-3 text-center">
            <p className="text-xl">15</p>
            <p className="text-xs opacity-90">Orders</p>
          </div>
          <div className="flex-1 bg-white/20 rounded-lg p-3 text-center">
            <p className="text-xl">8</p>
            <p className="text-xs opacity-90">Wishlist</p>
          </div>
          <div className="flex-1 bg-white/20 rounded-lg p-3 text-center">
            <p className="text-xl">4.9</p>
            <p className="text-xs opacity-90">Rating</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-foreground mb-3">Account</h2>
          <div className="bg-white rounded-lg border border-border">
            <Link
              to="/profile/edit"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Edit Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link
              to="/profile/addresses"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Saved Addresses</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link
              to="/profile/payment"
              className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Payment Methods</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-foreground mb-3">My Activity</h2>
          <div className="bg-white rounded-lg border border-border">
            <Link
              to="/orders"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">My Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">3</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
            <Link
              to="/wishlist"
              className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Wishlist</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Settings</h2>
          <div className="bg-white rounded-lg border border-border">
            <Link
              to="/settings/notifications"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link
              to="/settings/privacy"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Privacy & Security</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link
              to="/settings"
              className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">App Settings</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div className="bg-[#22c55e]/10 rounded-lg border border-[#22c55e]/20 p-4">
          <h3 className="text-foreground mb-2">Become a Seller</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Start your business on GreenHub and reach thousands of buyers
          </p>
          <Link
            to="/seller/dashboard"
            className="inline-block bg-[#22c55e] text-white px-6 py-2 rounded-lg"
          >
            Switch to Seller
          </Link>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Support</h2>
          <div className="bg-white rounded-lg border border-border">
            <Link
              to="/help"
              className="flex items-center justify-between p-4 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Help Center</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <span className="text-red-600">Logout</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>GreenHub v1.0.0</p>
          <p className="mt-1">Made with 💚 in Nigeria</p>
        </div>
      </div>
    </div>
  );
}
