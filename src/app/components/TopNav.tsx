import { Link, useLocation, useNavigate } from "react-router";
import { Bell, ShoppingCart, User, LogOut, Settings, Store, MessageSquare, BarChart2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { session, user: authUser, profile, signOut } = useAuth();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const notifications = [
    { id: 1, title: "Order Shipped", text: "Your order #ORD-099 has been shipped via GlobalExpress.", time: "1h ago", unread: true },
    { id: 2, title: "New Message", text: "You have a new message from Amina regarding the iPhone 13.", time: "2h ago", unread: true },
    { id: 3, title: "Welcome!", text: "Thanks for joining GreenHub Marketplace. Setup your store to start selling.", time: "1d ago", unread: false },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
    navigate("/login");
  };

  const hideNavOnPaths = ["/login", "/register", "/verify-otp"];
  const isHidden = hideNavOnPaths.some(path => location.pathname.startsWith(path));
  const isHome = location.pathname === "/";

  if (isHidden) return null;

  const bgClass = isHome ? "bg-[#22c55e]" : "bg-white border-b border-gray-200 shadow-sm";
  const textClass = isHome ? "text-white" : "text-[#22c55e]";
  const iconClass = isHome ? "text-white" : "text-gray-600 hover:text-[#22c55e]";
  const badgeClass = isHome ? "bg-white text-[#22c55e]" : "bg-[#22c55e] text-white";
  const designClass = isHome ? "text-green-100 hover:text-white" : "text-gray-500 hover:text-[#22c55e]";

  return (
    <div className={`${bgClass} sticky top-0 z-[45] transition-colors duration-200`}>
      <div className="h-16 px-4 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className={`text-2xl font-bold flex items-center gap-1 ${textClass}`}>
            🌿 GreenHub
          </Link>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative hidden md:block" ref={notifRef}>
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowDropdown(false);
              }}
              className="relative p-1 outline-none"
            >
              <Bell className={`w-6 h-6 transition-colors ${iconClass}`} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#ef4444] rounded-full border border-white"></span>
            </button>

            {showNotifications && (
              <div className="absolute top-full -right-4 md:right-0 mt-3 w-80 bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  <button className="text-[11px] text-[#22c55e] hover:underline font-bold uppercase tracking-wider">Mark read</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${notif.unread ? 'bg-blue-50/20' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm ${notif.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{notif.title}</h4>
                        <span className="text-[10px] text-gray-400 font-medium">{notif.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{notif.text}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-100 text-center bg-gray-50">
                  <button className="text-xs text-gray-600 hover:text-[#22c55e] font-semibold w-full py-1" onClick={() => setShowNotifications(false)}>View all notifications</button>
                </div>
              </div>
            )}
          </div>
          
          <Link to="/cart" className="relative p-1">
            <ShoppingCart className={`w-6 h-6 transition-colors ${iconClass}`} />
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-2 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white ${badgeClass}`}>
                {cartCount}
              </span>
            )}
          </Link>

          {session ? (
            <div className="flex items-center gap-3 md:gap-5">
              <div className="relative border-l pl-4 border-gray-200/30" ref={dropdownRef}>
                <button 
                  onClick={() => {
                    setShowDropdown(!showDropdown);
                    setShowNotifications(false);
                  }}
                  className="relative p-1 flex items-center gap-2 outline-none"
                >
                  <User className={`w-6 h-6 transition-colors ${iconClass}`} />
                </button>
                
                {showDropdown && (
                  <div className="absolute top-full right-0 mt-3 w-48 bg-white shadow-xl border border-gray-200 rounded-md py-2 z-50">
                    <Link 
                      to="/seller/dashboard" 
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <Store className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">My shop</span>
                    </Link>

                    <Link 
                      to="/messages" 
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <MessageSquare className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Feedback</span>
                    </Link>

                    <Link 
                      to="/seller/dashboard" 
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <BarChart2 className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Performance</span>
                    </Link>

                    <Link 
                      to="/settings" 
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <Settings className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Settings</span>
                    </Link>
                    
                    <button 
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <LogOut className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Log out</span>
                    </button>
                  </div>
                )}
              </div>
              <Link
                to="/seller/products/new"
                className="hidden md:flex bg-[#f97316] hover:bg-[#ea580c] text-white font-bold px-6 py-2 rounded shadow-sm transition-colors text-sm tracking-wide"
              >
                SELL
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-l pl-4 border-gray-200/30">
              <Link to="/login" className={`text-sm font-bold ${designClass}`}>Sign In</Link>
              <Link to="/register" className={`hidden md:flex text-sm font-bold px-4 py-2 rounded-lg transition-colors ${isHome ? "bg-white text-[#22c55e]" : "bg-[#22c55e] text-white"}`}>Sign Up</Link>
              <Link
                to="/register"
                className="hidden md:flex bg-[#f97316] hover:bg-[#ea580c] text-white font-bold ml-2 px-6 py-2 rounded shadow-sm transition-colors text-sm tracking-wide"
              >
                SELL
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
