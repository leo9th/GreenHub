import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router";
import Root from "./pages/Root";
import Home from "./pages/Home";
import About from "./pages/About";
import ApplyJob from "./pages/ApplyJob";
import HowToSell from "./pages/HowToSell";
import HowToBuy from "./pages/HowToBuy";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import FAQ from "./pages/FAQ";
import DesignSystem from "./pages/DesignSystem";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyOTP from "./pages/auth/VerifyOTP";
import CheckEmail from "./pages/auth/CheckEmail";
import CompleteProfile from "./pages/auth/CompleteProfile";
import Welcome from "./pages/Welcome";
import BookRide from "./pages/buyer/BookRide";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import WriteReview from "./pages/WriteReview";
import SellerReviews from "./pages/SellerReviews";
import Profile from "./pages/Profile";
import ProfileFollowList from "./pages/ProfileFollowList";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import WorkersBrowse from "./pages/workers/WorkersBrowse";
import WorkerProfileDetail from "./pages/workers/WorkerProfileDetail";
import WorkerProfileRegister from "./pages/workers/WorkerProfileRegister";
import Contact from "./pages/Contact";
import AdminLayout from "./pages/admin/AdminLayout";
import { AppErrorBoundary } from "./components/errors/AppErrorBoundary";

/** Code-split heavy routes (chat, seller, admin, large listing detail). */
function lazyPage(importer: () => Promise<{ default: ComponentType<unknown> }>) {
  return async () => {
    try {
      const m = await importer();
      return { Component: m.default };
    } catch (error) {
      // Vite can reject lazy imports on transient chunk/CSS preload failures.
      // Retry once before giving up so mobile/network hiccups don't blank the app.
      try {
        const m = await importer();
        return { Component: m.default };
      } catch {
        if (typeof window !== "undefined") {
          const key = "gh_lazy_reload_once";
          if (window.sessionStorage.getItem(key) !== "1") {
            window.sessionStorage.setItem(key, "1");
            window.location.reload();
            return { Component: () => null };
          }
          window.sessionStorage.removeItem(key);
        }
        throw error;
      }
    }
  };
}

function LegacySellRouteRedirect() {
  return <Navigate to="/seller/products/new" replace />;
}

function LegacyHelpRedirect() {
  return <Navigate to="/faq" replace />;
}

function LegacySupportRedirect() {
  return <Navigate to="/messages" replace />;
}

function LegacySettingsRedirect() {
  return <Navigate to="/settings" replace />;
}

function LegacyFavoritesRedirect() {
  return <Navigate to="/products" replace />;
}

function LegacyReviewsRedirect() {
  return <Navigate to="/orders" replace />;
}

function LegacyAdminRedirect() {
  return <Navigate to="/admin/dashboard" replace />;
}

function LegacyAdvertiseSetupRedirect() {
  return <Navigate to="/seller/advertise" replace />;
}

function LegacySellerProductEditRedirect() {
  const { id } = useParams();
  if (!id?.trim()) return <Navigate to="/seller/products" replace />;
  return <Navigate to={`/seller/products/edit/${encodeURIComponent(id.trim())}`} replace />;
}

function LegacyRiderJobRedirect() {
  const { id } = useParams();
  if (!id?.trim()) return <Navigate to="/rider" replace />;
  return <Navigate to={`/rider/requests/${encodeURIComponent(id.trim())}`} replace />;
}

function CheckoutWithErrorBoundary() {
  return (
    <AppErrorBoundary scope="section" boundaryName="checkout">
      <Checkout />
    </AppErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "about", Component: About },
      { path: "apply", Component: ApplyJob },
      { path: "workers", Component: WorkersBrowse },
      { path: "workers/register", Component: WorkerProfileRegister },
      { path: "workers/:id", Component: WorkerProfileDetail },
      { path: "how-to-sell", Component: HowToSell },
      { path: "how-to-buy", Component: HowToBuy },
      { path: "terms", Component: Terms },
      { path: "privacy", Component: Privacy },
      { path: "faq", Component: FAQ },
      { path: "chatbot", element: <Navigate to="/" replace /> },
      { path: "design-system", Component: DesignSystem },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "verify-otp", Component: VerifyOTP },
      { path: "check-email", Component: CheckEmail },
      { path: "complete-profile", Component: CompleteProfile },
      { path: "welcome", Component: Welcome },
      { path: "products", Component: Products },
      {
        path: "products/:productId/write-review",
        lazy: lazyPage(() => import("./pages/WriteProductReview")),
      },
      { path: "products/:id", lazy: lazyPage(() => import("./pages/ProductDetail")) },
      { path: "book", Component: BookRide },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: CheckoutWithErrorBoundary },
      {
        path: "rider",
        lazy: lazyPage(() => import("./pages/rider/RiderLayout")),
        children: [
          { index: true, lazy: lazyPage(() => import("./pages/rider/RiderDashboard")) },
          { path: "requests/:requestId", lazy: lazyPage(() => import("./pages/rider/RiderRequestDetail")) },
          { path: "product-rides/:bookingId", lazy: lazyPage(() => import("./pages/rider/RiderProductRideDetail")) },
        ],
      },
      { path: "rider/job/:id", Component: LegacyRiderJobRedirect },
      { path: "orders", Component: Orders },
      { path: "orders/:id", lazy: lazyPage(() => import("./pages/OrderDetail")) },
      { path: "messages", lazy: lazyPage(() => import("./pages/Messages")) },
      /* c = thread by conversation id; u = DM by other user’s auth id. Do not use one path for both UUID types. */
      { path: "messages/c/:conversationId", lazy: lazyPage(() => import("./pages/Chat")) },
      { path: "messages/u/:peerUserId", lazy: lazyPage(() => import("./pages/Chat")) },
      /* Back-compat: old inbox links /messages/:conversationId (thread id only — not a peer user id). */
      { path: "messages/:legacyThreadId", lazy: lazyPage(() => import("./pages/Chat")) },
      { path: "chat-v2/:id", lazy: lazyPage(() => import("./pages/ChatV2")) },
      { path: "seller/dashboard", lazy: lazyPage(() => import("./pages/seller/Dashboard")) },
      { path: "seller/products", lazy: lazyPage(() => import("./pages/seller/Products")) },
      { path: "seller/products/new", lazy: lazyPage(() => import("./pages/seller/AddProduct")) },
      { path: "seller/products/add", Component: LegacySellRouteRedirect },
      { path: "seller/products/edit/:id", lazy: lazyPage(() => import("./pages/seller/EditProduct")) },
      { path: "seller/products/:id/edit", Component: LegacySellerProductEditRedirect },
      { path: "seller/bank-details", lazy: lazyPage(() => import("./pages/seller/BankDetails")) },
      { path: "seller/verification", lazy: lazyPage(() => import("./pages/seller/Verification")) },
      { path: "seller/advertise", lazy: lazyPage(() => import("./pages/seller/Advertise")) },
      { path: "seller/advertise/setup", element: <LegacyAdvertiseSetupRedirect /> },
      { path: "seller/boosts", lazy: lazyPage(() => import("./pages/seller/MyBoosts")) },
      { path: "reviews/:orderId", Component: WriteReview },
      { path: "seller/:id/reviews", Component: SellerReviews },
      { path: "profile/:id/followers", Component: ProfileFollowList },
      { path: "profile/:id/following", Component: ProfileFollowList },
      { path: "profile/:id", Component: Profile },
      { path: "profile", Component: Profile },
      { path: "favorites", Component: LegacyFavoritesRedirect },
      { path: "reviews", Component: LegacyReviewsRedirect },
      { path: "settings/profile/edit", Component: ProfileEdit },
      { path: "settings", Component: Settings },
      { path: "settings/password", Component: LegacySettingsRedirect },
      { path: "settings/address", Component: LegacySettingsRedirect },
      { path: "settings/privacy", Component: LegacySettingsRedirect },
      { path: "settings/blocked-users", Component: LegacySettingsRedirect },
      { path: "settings/language", Component: LegacySettingsRedirect },
      {
        path: "admin",
        Component: AdminLayout,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", lazy: lazyPage(() => import("./pages/admin/Dashboard")) },
          { path: "users", lazy: lazyPage(() => import("./pages/admin/Users")) },
          { path: "products", lazy: lazyPage(() => import("./pages/admin/Products")) },
          { path: "pricing", lazy: lazyPage(() => import("./pages/admin/AdPricingControl")) },
          { path: "job-applications", lazy: lazyPage(() => import("./pages/admin/JobApplications")) },
          { path: "boosts", lazy: lazyPage(() => import("./pages/admin/AdminBoosts")) },
          { path: "chatbot-learning", lazy: lazyPage(() => import("./pages/admin/AdminChatbotLearning")) },
          { path: "dispatch", lazy: lazyPage(() => import("./pages/admin/Dispatch")) },
          { path: "order-reviews", lazy: lazyPage(() => import("./pages/admin/OrderReviews")) },
          { path: "orders", Component: LegacyAdminRedirect },
          { path: "reports", Component: LegacyAdminRedirect },
        ],
      },
      { path: "help", Component: LegacyHelpRedirect },
      { path: "support", Component: LegacySupportRedirect },
      { path: "contact", Component: Contact },
      { path: "*", Component: NotFound },
    ],
  },
]);
