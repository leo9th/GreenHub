import { Link, useLocation, useNavigate } from "react-router";
import { Bell, ShoppingCart, LogOut, Settings, Store, MessageSquare, BarChart2, ClipboardList } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useInboxNotifications } from "../context/InboxNotificationsContext";
import { getAvatarUrl } from "../utils/getAvatar";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { markNotificationReadById } from "../utils/engagement";

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { session, user: authUser, profile, signOut } = useAuth();
  const {
    messageUnread,
    notifications,
    notificationUnreadCount,
    markAllNotificationsReadAndRefresh,
    refresh: refreshNotifications,
  } = useInboxNotifications();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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
  const isHidden = hideNavOnPaths.some((path) => location.pathname.startsWith(path));
  const isHome = location.pathname === "/";

  const fullName =
    profile?.full_name?.trim() ||
    authUser?.user_metadata?.full_name?.trim() ||
    authUser?.email?.split("@")[0] ||
    "User";
  const avatarUrl = getAvatarUrl(
    profile?.avatar_url || authUser?.user_metadata?.avatar_url,
    profile?.gender || authUser?.user_metadata?.gender,
    fullName,
  );

  const openNotification = useCallback(
    async (n: (typeof notifications)[0]) => {
      if (n.read_at == null) {
        await markNotificationReadById(supabase, n.id);
        void refreshNotifications();
      }
      setShowNotifications(false);
      const cid = n.data && typeof n.data === "object" ? (n.data as { conversation_id?: string }).conversation_id : null;
      if (n.type === "message" && cid) {
        navigate(`/messages/c/${cid}`);
      }
    },
    [navigate, refreshNotifications],
  );

  if (isHidden) return null;

  const bgClass = isHome ? "bg-[#22c55e]" : "bg-white border-b border-gray-200 shadow-sm";
  const textClass = isHome ? "text-white" : "text-[#22c55e]";
  const iconClass = isHome ? "text-white" : "text-gray-600 hover:text-[#22c55e]";
  const badgeClass = isHome ? "bg-white text-[#22c55e]" : "bg-[#22c55e] text-white";
  const designClass = isHome ? "text-green-100 hover:text-white" : "text-gray-500 hover:text-[#22c55e]";

  const messageBadgeEl =
    messageUnread > 0 ? (
      <span
        className={`absolute -top-1 -right-2 text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 px-0.5 flex items-center justify-center border border-white ${badgeClass}`}
      >
        {messageUnread > 99 ? "99+" : messageUnread}
      </span>
    ) : null;

  return (
    <div className={`${bgClass} sticky top-0 z-[45] transition-colors duration-200`}>
      <div className="h-16 px-3 sm:px-4 max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link to="/" className={`text-xl sm:text-2xl font-bold flex items-center gap-1 shrink-0 ${textClass}`}>
            🌿 GreenHub
          </Link>
          <Link
            to="/products"
            className={`text-sm font-bold shrink-0 whitespace-nowrap ${
              isHome ? "text-white/95 hover:text-white" : "text-[#15803d] hover:text-[#22c55e]"
            }`}
          >
            Shop
          </Link>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {session ? (
            <div className="relative hidden md:block" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowDropdown(false);
                }}
                className="relative p-1 outline-none"
                aria-label="Notifications"
              >
                <Bell className={`w-6 h-6 transition-colors ${iconClass}`} />
                {notificationUnreadCount > 0 ? (
                  <span className="absolute top-0 right-0 min-w-[10px] h-2.5 px-0.5 bg-[#ef4444] rounded-full border border-white" />
                ) : null}
              </button>

              {showNotifications && (
                <div className="absolute top-full -right-4 md:right-0 mt-3 w-80 bg-white shadow-xl border border-gray-100 rounded-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800">Notifications</h3>
                    <button
                      type="button"
                      className="text-[11px] text-[#22c55e] hover:underline font-bold uppercase tracking-wider"
                      onClick={() => void markAllNotificationsReadAndRefresh()}
                    >
                      Mark read
                    </button>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => void openNotification(notif)}
                          className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            notif.read_at == null ? "bg-blue-50/20" : ""
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4
                              className={`text-sm ${
                                notif.read_at == null ? "font-bold text-gray-900" : "font-medium text-gray-800"
                              }`}
                            >
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 font-medium shrink-0">
                              {formatNotifTime(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{notif.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 text-center bg-gray-50">
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:text-[#22c55e] font-semibold w-full py-1"
                      onClick={() => setShowNotifications(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <Link to="/cart" className="relative p-1">
            <ShoppingCart className={`w-6 h-6 transition-colors ${iconClass}`} />
            {cartCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white ${badgeClass}`}
              >
                {cartCount}
              </span>
            )}
          </Link>

          {session ? (
            <Link to="/messages" className="relative p-1" title="Messages" aria-label="Messages">
              <MessageSquare className={`w-6 h-6 transition-colors ${iconClass}`} />
              {messageBadgeEl}
            </Link>
          ) : null}

          {session ? (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative border-l pl-2 md:pl-3 border-gray-200/30" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(!showDropdown);
                    setShowNotifications(false);
                  }}
                  className="relative p-1 flex items-center gap-2 outline-none"
                >
                  <img src={avatarUrl} alt={fullName} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                </button>

                {showDropdown && (
                  <div className="absolute top-full right-0 mt-3 w-48 bg-white shadow-xl border border-gray-200 rounded-md py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <img src={avatarUrl} alt={fullName} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Welcome back</p>
                          <p className="text-base font-semibold text-gray-900 leading-tight">{fullName}</p>
                          <Link
                            to="/profile"
                            onClick={() => setShowDropdown(false)}
                            className="text-xs text-[#22c55e] hover:underline"
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </div>
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
                      className="relative flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <MessageSquare className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Messages</span>
                      {messageUnread > 0 ? (
                        <span className="ml-auto text-[10px] font-bold bg-[#ef4444] text-white rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-center">
                          {messageUnread > 99 ? "99+" : messageUnread}
                        </span>
                      ) : null}
                    </Link>

                    <Link
                      to="/orders"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      <ClipboardList className="w-[18px] h-[18px] text-gray-500" />
                      <span className="text-[14px] font-medium">Orders</span>
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
                      type="button"
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
              <Link to="/login" className={`text-sm font-bold ${designClass}`}>
                Sign In
              </Link>
              <Link
                to="/register"
                className={`hidden md:flex text-sm font-bold px-4 py-2 rounded-lg transition-colors ${
                  isHome ? "bg-white text-[#22c55e]" : "bg-[#22c55e] text-white"
                }`}
              >
                Sign Up
              </Link>
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
