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
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import ChatV2 from "./pages/ChatV2";
import SellerDashboard from "./pages/seller/Dashboard";
import SellerProducts from "./pages/seller/Products";
import AddProduct from "./pages/seller/AddProduct";
import EditProduct from "./pages/seller/EditProduct";
import BankDetails from "./pages/seller/BankDetails";
import Advertise from "./pages/seller/Advertise";
import MyBoosts from "./pages/seller/MyBoosts";
import AdminBoosts from "./pages/admin/AdminBoosts";
import AdminChatbotLearning from "./pages/admin/AdminChatbotLearning";
import SellerVerification from "./pages/seller/Verification";
import WriteReview from "./pages/WriteReview";
import WriteProductReview from "./pages/WriteProductReview";
import SellerReviews from "./pages/SellerReviews";
import Profile from "./pages/Profile";
import ProfileFollowList from "./pages/ProfileFollowList";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProducts from "./pages/admin/Products";
import AdPricingControl from "./pages/admin/AdPricingControl";
import AdminJobApplications from "./pages/admin/JobApplications";
import NotFound from "./pages/NotFound";
import WorkersBrowse from "./pages/workers/WorkersBrowse";
import WorkerProfileDetail from "./pages/workers/WorkerProfileDetail";
import WorkerProfileRegister from "./pages/workers/WorkerProfileRegister";
import Contact from "./pages/Contact";

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
      { path: "products", Component: Products },
      { path: "products/:productId/write-review", Component: WriteProductReview },
      { path: "products/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: Checkout },
      { path: "orders", Component: Orders },
      { path: "orders/:id", Component: OrderDetail },
      { path: "messages", Component: Messages },
      /* c = thread by conversation id; u = DM by other user’s auth id. Do not use one path for both UUID types. */
      { path: "messages/c/:conversationId", Component: Chat },
      { path: "messages/u/:peerUserId", Component: Chat },
      /* Back-compat: old inbox links /messages/:conversationId (thread id only — not a peer user id). */
      { path: "messages/:legacyThreadId", Component: Chat },
      { path: "chat-v2/:id", Component: ChatV2 },
      { path: "seller/dashboard", Component: SellerDashboard },
      { path: "seller/products", Component: SellerProducts },
      { path: "seller/products/new", Component: AddProduct },
      { path: "seller/products/add", Component: LegacySellRouteRedirect },
      { path: "seller/products/edit/:id", Component: EditProduct },
      { path: "seller/products/:id/edit", Component: LegacySellerProductEditRedirect },
      { path: "seller/bank-details", Component: BankDetails },
      { path: "seller/verification", Component: SellerVerification },
      { path: "seller/advertise", Component: Advertise },
      { path: "seller/advertise/setup", element: <LegacyAdvertiseSetupRedirect /> },
      { path: "seller/boosts", Component: MyBoosts },
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
      { path: "admin/dashboard", Component: AdminDashboard },
      { path: "admin/users", Component: AdminUsers },
      { path: "admin/products", Component: AdminProducts },
      { path: "admin/pricing", Component: AdPricingControl },
      { path: "admin/job-applications", Component: AdminJobApplications },
      { path: "admin/boosts", Component: AdminBoosts },
      { path: "admin/chatbot-learning", Component: AdminChatbotLearning },
      { path: "admin/orders", Component: LegacyAdminRedirect },
      { path: "admin/reports", Component: LegacyAdminRedirect },
      { path: "help", Component: LegacyHelpRedirect },
      { path: "support", Component: LegacySupportRedirect },
      { path: "contact", Component: Contact },
      { path: "*", Component: NotFound },
    ],
  },
]);
