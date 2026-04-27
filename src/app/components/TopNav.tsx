import { Link, useLocation, useNavigate } from "react-router";
import {
  Bell,
  Bike,
  ShoppingCart,
  LogOut,
  Settings,
  Store,
  MessageSquare,
  BarChart2,
  ClipboardList,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useInboxNotifications } from "../context/InboxNotificationsContext";
import { getAvatarUrl } from "../utils/getAvatar";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { markNotificationReadById } from "../utils/engagement";
import { formatGreenHubRelative } from "../utils/formatGreenHubTime";
import { riderFabModeStorageKey } from "../utils/riderFabMode";
import { useTheme } from "../context/ThemeContext";
import AdvancedSearch from "./AdvancedSearch";

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
  const { resolvedTheme, toggleTheme } = useTheme();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBookGoMenu, setShowBookGoMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const bookGoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
      if (bookGoRef.current && !bookGoRef.current.contains(event.target as Node)) {
        setShowBookGoMenu(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
    setShowBookGoMenu(false);
    navigate("/login");
  };

  const handleSwitchToRiderMode = useCallback(() => {
    setShowBookGoMenu(false);
    if (!authUser?.id) {
      navigate("/login");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(riderFabModeStorageKey(authUser.id), "rider");
    }
    navigate("/rider");
  }, [authUser?.id, navigate]);

  const hideNavOnPaths = ["/login", "/register", "/verify-otp", "/welcome"];
  const isHidden = hideNavOnPaths.some((path) => location.pathname.startsWith(path));
  const isHome = location.pathname === "/";
  const notifyMarkAllReadError = useCallback((error: string) => {
    toast.error("Could not mark notifications read. Check Supabase notifications RLS.");
    console.warn("markAllNotificationsRead:", error);
  }, []);

  const openNotification = useCallback(
    async (n: (typeof notifications)[0]) => {
      if (n.read_at == null) {
        await markNotificationReadById(supabase, n.id);
        void refreshNotifications();
      }
      setShowNotifications(false);
      const data = n.data && typeof n.data === "object" ? (n.data as Record<string, unknown>) : {};
      const cid = typeof data.conversation_id === "string" ? data.conversation_id : null;
      const orderId = typeof data.order_id === "string" ? data.order_id : null;
      const deliveryRequestId =
        typeof data.delivery_request_id === "string"
          ? data.delivery_request_id
          : typeof data.delivery_id === "string"
            ? data.delivery_id
            : typeof data.job_id === "string"
              ? data.job_id
              : null;

      if (n.type === "message" && cid) {
        navigate(`/messages/c/${cid}`);
        return;
      }
      if ((n.type === "order_placed" || n.type === "payment_received") && orderId) {
        navigate(`/orders/${orderId}`);
        return;
      }
      if (n.type === "delivery_job_assigned" && deliveryRequestId) {
        navigate(`/rider/job/${deliveryRequestId}`);
        return;
      }
      if (n.type === "delivery_status_changed" && orderId) {
        navigate(`/orders/${orderId}`);
      }
    },
    [navigate, refreshNotifications],
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setShowBookGoMenu(false);
  }, [location.pathname]);

  // #region agent log
  void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
    body: JSON.stringify({
      sessionId: "35665f",
      runId: "run2",
      hypothesisId: "H2",
      location: "TopNav.tsx:post-hooks",
      message: "TopNav reached post-hooks checkpoint",
      data: {
        pathname: location.pathname,
        isHidden,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (isHidden) return null;

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

  const roleFromProfile =
    typeof profile?.role === "string" ? profile.role.toLowerCase() : "";
  const isAdmin = roleFromProfile === "admin";

  const bgClass = isHome
    ? "bg-[#22c55e] dark:bg-emerald-950 dark:border-b dark:border-emerald-900"
    : "bg-white dark:bg-zinc-900/95 border-b border-gray-200 dark:border-zinc-800 shadow-sm";
  const textClass = isHome ? "text-white" : "text-[#22c55e] dark:text-emerald-400";
  const iconClass = isHome
    ? "text-white"
    : "text-gray-600 hover:text-[#22c55e] dark:text-zinc-400 dark:hover:text-emerald-400";
  const designClass = isHome
    ? "text-green-100 hover:text-white"
    : "text-gray-500 hover:text-[#22c55e] dark:text-zinc-400 dark:hover:text-emerald-400";
  const themeBtnHover = isHome ? "hover:bg-white/15" : "hover:bg-gray-100 dark:hover:bg-zinc-800";

  const navIconClass = `h-4 w-4 sm:h-5 sm:w-5 shrink-0 transition-colors ${iconClass}`;
  const countBadgeClass =
    "absolute -top-0.5 -right-1.5 p-0 text-[10px] font-bold leading-none text-red-500 dark:text-red-400";
  const contrastIconClass = isHome ? "text-white" : "text-gray-600 dark:text-gray-300";
  const totalUnread = (notificationUnreadCount || 0) + (messageUnread || 0);

  return (
    <div className={`${bgClass} sticky top-0 z-[45] transition-colors duration-200`}>
      <div className="h-16 px-2 sm:px-4 max-w-7xl mx-auto flex flex-nowrap items-center justify-between gap-1 md:gap-2 min-w-0 overflow-x-hidden overflow-y-visible">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2">
          <Link
            to="/"
            className={`flex min-w-0 shrink-0 items-center gap-1 whitespace-nowrap pr-1 text-sm font-bold sm:text-xl md:text-2xl ${textClass}`}
          >
            🌿 GreenHub
          </Link>
          <Link
            to="/products"
            className={`hidden md:inline-flex text-sm font-bold shrink-0 whitespace-nowrap items-center ${
              isHome ? "text-white/95 hover:text-white" : "text-[#15803d] hover:text-[#22c55e] dark:text-emerald-400"
            }`}
          >
            Shop
          </Link>
          <div className="hidden md:block w-[320px] xl:w-[380px]">
            <AdvancedSearch
              className="w-full"
              placeholder="Search GreenHub..."
              onSelectCategory={(category) => navigate(`/products?search=${encodeURIComponent(category)}`)}
            />
          </div>
          <div className="relative shrink-0 md:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((o) => !o);
                setShowDropdown(false);
                setShowNotifications(false);
                setShowBookGoMenu(false);
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 sm:h-11 sm:w-11 sm:p-1.5 outline-none transition-colors ${contrastIconClass} ${themeBtnHover}`}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" strokeWidth={2.25} />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={2.25} />
              )}
            </button>
            {mobileMenuOpen ? (
              <div className="absolute left-0 top-full z-[60] mt-2 min-w-[12.5rem] rounded-lg border border-gray-200 bg-white py-2 shadow-xl dark:border-border dark:bg-card">
                <Link
                  to="/products"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                >
                  Shop
                </Link>
                {session ? (
                  <>
                    <Link
                      to="/seller/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <Store className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>My shop</span>
                    </Link>
                    <Link
                      to="/messages"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <MessageSquare className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>Messages</span>
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <ClipboardList className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>Orders</span>
                    </Link>
                    <Link
                      to="/seller/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <BarChart2 className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>Performance</span>
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <Settings className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>Settings</span>
                    </Link>
                    {isAdmin ? (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="mx-2 my-1 flex items-center gap-3 rounded-lg border border-emerald-500/60 bg-emerald-50/90 px-3 py-2.5 text-sm font-semibold text-emerald-800 shadow-[0_0_14px_-4px_rgba(16,185,129,0.55)] transition-colors hover:bg-emerald-100/90 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
                      >
                        <LayoutDashboard className="h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Admin</span>
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void handleSignOut();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      <LogOut className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span>Log out</span>
                    </button>
                    <Link
                      to="/seller/products/new"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm font-bold text-[#ea580c] hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      SELL
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                    >
                      Sign Up
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm font-bold text-[#ea580c] hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      SELL
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => toggleTheme()}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 sm:h-11 sm:w-11 sm:p-1.5 outline-none transition-colors ${iconClass} ${themeBtnHover}`}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            <span className="text-base sm:text-lg leading-none select-none" aria-hidden>
              {resolvedTheme === "dark" ? "☀️" : "🌙"}
            </span>
          </button>
          <div className="relative" ref={bookGoRef}>
            <button
              type="button"
              onClick={() => {
                setShowBookGoMenu((v) => !v);
                setShowNotifications(false);
                setShowDropdown(false);
                setMobileMenuOpen(false);
              }}
              className={`relative flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg px-1 py-0.5 sm:h-11 sm:px-1.5 outline-none transition-colors ${contrastIconClass} ${themeBtnHover}`}
              aria-haspopup="menu"
              aria-expanded={showBookGoMenu}
              aria-label="bookGo menu"
              title="bookGo"
            >
              <Bike className={`hidden sm:block ${navIconClass}`} />
              <span className="text-[9px] font-semibold leading-none sm:text-[11px]">bookGo</span>
            </button>
            {showBookGoMenu ? (
              <div className="absolute top-full right-0 z-50 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-2 shadow-xl dark:border-border dark:bg-card">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookGoMenu(false);
                    navigate("/rider");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                >
                  <Bike className="h-[18px] w-[18px] text-gray-500 dark:text-muted-foreground" />
                  <span>Book dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToRiderMode}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#15803d] transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <Bike className="h-[18px] w-[18px]" />
                  <span>Switch to Rider mode</span>
                </button>
              </div>
            ) : null}
          </div>

          {session ? (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  void markAllNotificationsReadAndRefresh().then(({ error }) => {
                    if (error) notifyMarkAllReadError(error);
                  });
                  const willOpen = !showNotifications;
                  setShowNotifications(willOpen);
                  setShowDropdown(false);
                  setMobileMenuOpen(false);
                  setShowBookGoMenu(false);
                }}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 sm:h-11 sm:w-11 sm:p-1.5 outline-none transition-colors ${contrastIconClass} ${themeBtnHover}`}
                aria-label="Notifications"
              >
                <span className="relative inline-flex">
                  <Bell className={navIconClass} />
                  {totalUnread > 0 ? (
                    <span className={countBadgeClass} aria-hidden>
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  ) : null}
                </span>
              </button>

              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 sm:mt-3 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] sm:w-80 bg-white dark:bg-card shadow-xl border border-gray-100 dark:border-border rounded-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex justify-between items-center bg-gray-50/50 dark:bg-muted/50">
                    <h3 className="font-semibold text-gray-800 dark:text-foreground">Notifications</h3>
                    <button
                      type="button"
                      className="text-[11px] text-[#22c55e] hover:underline font-bold uppercase tracking-wider"
                      onClick={() =>
                        void markAllNotificationsReadAndRefresh().then(({ error }) => {
                          if (error) notifyMarkAllReadError(error);
                        })
                      }
                    >
                      Mark read
                    </button>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 dark:text-muted-foreground text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => void openNotification(notif)}
                          className={`w-full text-left p-4 border-b border-gray-50 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/60 transition-colors ${
                            notif.read_at == null ? "bg-blue-50/20 dark:bg-blue-950/30" : ""
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4
                              className={`text-sm ${
                                notif.read_at == null
                                  ? "font-bold text-gray-900 dark:text-foreground"
                                  : "font-medium text-gray-800 dark:text-foreground/90"
                              }`}
                            >
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 dark:text-muted-foreground font-medium shrink-0">
                              {formatGreenHubRelative(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-muted-foreground line-clamp-2 leading-relaxed">{notif.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 dark:border-border text-center bg-gray-50 dark:bg-muted/40">
                    <button
                      type="button"
                      className="text-xs text-gray-600 dark:text-muted-foreground hover:text-[#22c55e] dark:hover:text-emerald-400 font-semibold w-full py-1"
                      onClick={() => setShowNotifications(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <Link
            to="/cart"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 sm:h-11 sm:w-11 sm:p-1.5"
            title="Cart"
            aria-label="Cart"
          >
            <ShoppingCart className={navIconClass} />
            {cartCount > 0 && (
              <span className={countBadgeClass} aria-hidden>{cartCount > 99 ? "99+" : cartCount}</span>
            )}
          </Link>

          {session ? (
            <div className="flex items-center gap-1 md:gap-2">
              <div className="relative border-l border-gray-200/30 pl-1.5 dark:border-zinc-700/50 sm:pl-2 md:pl-3" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowDropdown((prev) => !prev);
                    setShowNotifications(false);
                    setMobileMenuOpen(false);
                    setShowBookGoMenu(false);
                  }}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 sm:h-11 sm:w-11 sm:p-1.5 outline-none transition-colors ${contrastIconClass} ${themeBtnHover}`}
                  aria-haspopup="menu"
                  aria-expanded={showDropdown}
                  aria-label="Account menu"
                >
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-7 w-7 rounded-full border border-gray-200 object-cover dark:border-zinc-600 sm:h-8 sm:w-8"
                  />
                </button>

                {showDropdown && (
                  <div className="absolute top-full right-0 mt-3 w-48 bg-white dark:bg-card shadow-xl border border-gray-200 dark:border-border rounded-md py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-border">
                      <div className="flex items-center gap-3">
                        <img src={avatarUrl} alt={fullName} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-muted-foreground">Welcome back</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-foreground leading-tight">{fullName}</p>
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
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <Store className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span className="text-[14px] font-medium">My shop</span>
                    </Link>

                    <Link
                      to="/messages"
                      onClick={() => setShowDropdown(false)}
                      className="relative flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <MessageSquare className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
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
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <ClipboardList className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span className="text-[14px] font-medium">Orders</span>
                    </Link>

                    {isAdmin ? (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setShowDropdown(false)}
                        className="mx-2 mb-1 flex items-center gap-3 rounded-lg border border-emerald-500/60 bg-emerald-50/90 px-3 py-2.5 shadow-[0_0_14px_-4px_rgba(16,185,129,0.55)] transition-colors hover:bg-emerald-100/90 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70"
                      >
                        <LayoutDashboard className="h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-200">Admin</span>
                      </Link>
                    ) : null}

                    <Link
                      to="/seller/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <BarChart2 className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span className="text-[14px] font-medium">Performance</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <Settings className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
                      <span className="text-[14px] font-medium">Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-foreground transition-colors"
                    >
                      <LogOut className="w-[18px] h-[18px] text-gray-500 dark:text-muted-foreground" />
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
            <div className="flex items-center gap-1.5 border-l border-gray-200/30 pl-2 dark:border-zinc-700/50 sm:gap-3 sm:pl-4">
              <Link to="/login" className={`shrink-0 text-xs font-bold sm:text-sm ${designClass}`}>
                Sign In
              </Link>
              <Link
                to="/register"
                className={`hidden md:flex text-sm font-bold px-4 py-2 rounded-lg transition-colors ${
                  isHome
                    ? "bg-white text-[#22c55e] dark:bg-emerald-100 dark:text-emerald-900"
                    : "bg-[#22c55e] text-white dark:bg-emerald-600"
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