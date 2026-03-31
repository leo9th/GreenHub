import { Outlet, Link, useLocation } from "react-router";
import { Home, Package, ShoppingCart, MessageSquare, User, LayoutDashboard } from "lucide-react";

export function MainLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex flex-col h-screen bg-muted">
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
              <span className="text-white font-bold">G</span>
            </div>
            <span className="font-bold text-lg text-foreground">GreenHub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/checkout" className="relative">
              <ShoppingCart className="w-6 h-6 text-foreground" />
              <span className="absolute -top-1 -right-1 bg-[#22c55e] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                2
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="bg-white border-t border-border sticky bottom-0">
        <div className="flex justify-around items-center max-w-7xl mx-auto">
          <Link
            to="/"
            className={`flex flex-col items-center py-3 px-4 ${isActive('/') && location.pathname === '/' ? 'text-[#22c55e]' : 'text-muted-foreground'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            to="/products"
            className={`flex flex-col items-center py-3 px-4 ${isActive('/products') ? 'text-[#22c55e]' : 'text-muted-foreground'}`}
          >
            <Package className="w-6 h-6" />
            <span className="text-xs mt-1">Products</span>
          </Link>
          <Link
            to="/orders"
            className={`flex flex-col items-center py-3 px-4 ${isActive('/orders') ? 'text-[#22c55e]' : 'text-muted-foreground'}`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs mt-1">Orders</span>
          </Link>
          <Link
            to="/messages"
            className={`flex flex-col items-center py-3 px-4 ${isActive('/messages') ? 'text-[#22c55e]' : 'text-muted-foreground'}`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs mt-1">Messages</span>
          </Link>
          <Link
            to="/profile"
            className={`flex flex-col items-center py-3 px-4 ${isActive('/profile') ? 'text-[#22c55e]' : 'text-muted-foreground'}`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
