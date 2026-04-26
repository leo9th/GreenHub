import { useLocation, Link } from "react-router";
import { ScrollRestoration } from "react-router-dom";
import { Briefcase, Wallet, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { useEffect } from "react";
import AnimatedOutlet from "../components/AnimatedOutlet";
import Footer from "../components/Footer";
import FloatingChatbotWidget from "../components/FloatingChatbotWidget";
import RiderPresenceFab from "../components/rider/RiderPresenceFab";
import TopNav from "../components/TopNav";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { pingLastActiveThrottled } from "../utils/lastActiveHeartbeat";

export default function Root() {
  const location = useLocation();
  const { user, session } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    pingLastActiveThrottled(supabase);
  }, [location.pathname, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const onVis = () => {
      if (document.visibilityState === "visible") pingLastActiveThrottled(supabase);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [user?.id]);
  const hideNavOnPaths = [
    "/login",
    "/register",
    "/verify-otp",
    "/check-email",
    "/complete-profile",
    "/welcome",
    "/forgot-password",
    "/reset-password",
    "/design-system",
  ];
  const isAdminShell = location.pathname.startsWith("/admin");
  const isMessageThread =
    location.pathname !== "/messages" &&
    (/^\/messages\/c\//.test(location.pathname) ||
      /^\/messages\/u\//.test(location.pathname) ||
      /^\/messages\/[^/]+$/.test(location.pathname) ||
      /^\/chat-v2\//.test(location.pathname));
  /** Hide site assistant on DM screens so it does not cover the message composer. */
  const hideFloatingChatbot =
    hideNavOnPaths.some((path) => location.pathname.startsWith(path)) || isMessageThread || isAdminShell;
  const showBottomNav =
    !hideNavOnPaths.some((path) => location.pathname.startsWith(path)) && !isMessageThread && !isAdminShell;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col transition-colors duration-200">
      <main className={`flex-1 flex flex-col ${showBottomNav ? "pb-28 md:pb-0" : ""}`}>
        {!isAdminShell ? <TopNav /> : null}
        <AnimatedOutlet />
        {showBottomNav ? <Footer /> : null}
        <ScrollRestoration />
      </main>

      {!hideFloatingChatbot ? <FloatingChatbotWidget /> : null}
      <RiderPresenceFab />

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-center gap-2 sm:gap-3 px-2 sm:px-3 h-16 max-w-7xl mx-auto w-full">
            <BottomActionCard
              to="/products"
              icon={<Package className="w-5 h-5 text-[#1b5e20]" />}
              label="Shop"
              bg="bg-[#e8f5e9]"
              border="border-[#66bb6a]"
            />
            <BottomActionCard
              to="/how-to-buy"
              icon={<ShoppingBag className="w-5 h-5 text-[#512da8]" />}
              label="How to buy"
              bg="bg-[#ede7f6]"
              border="border-[#b39ddb]"
            />
            <BottomActionCard
              to="/how-to-sell"
              icon={<Wallet className="w-5 h-5 text-[#2e7d32]" />}
              label="How to sell"
              bg="bg-[#e8f5e9]"
              border="border-[#a5d6a7]"
            />
            {session ? (
              <BottomActionCard
                to="/seller/advertise"
                icon={<TrendingUp className="w-5 h-5 text-[#ea580c]" />}
                label="Boost Ads"
                bg="bg-[#ffedd5]"
                border="border-[#fdba74]"
              />
            ) : (
              <BottomActionCard
                to="/apply"
                icon={<Briefcase className="w-5 h-5 text-[#2e7d32]" />}
                label="Apply for job"
                bg="bg-[#e8f5e9]"
                border="border-[#a5d6a7]"
              />
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function BottomActionCard({ to, icon, label, bg, border }: any) {
  return (
    <Link to={to} className={`flex-1 flex flex-col items-center justify-center h-[52px] rounded-lg border ${bg} ${border} hover:opacity-80 transition-opacity`}>
      {icon}
      <span className="text-[10px] sm:text-xs font-semibold text-gray-800 dark:text-zinc-200 mt-0.5">{label}</span>
    </Link>
  );
}
