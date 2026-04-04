import { createBrowserRouter, Navigate } from "react-router";
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
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import SellerDashboard from "./pages/seller/Dashboard";
import SellerProducts from "./pages/seller/Products";
import AddProduct from "./pages/seller/AddProduct";
import BankDetails from "./pages/seller/BankDetails";
import Advertise from "./pages/seller/Advertise";
import SetupAd from "./pages/seller/SetupAd";
import SellerVerification from "./pages/seller/Verification";
import WriteReview from "./pages/WriteReview";
import SellerReviews from "./pages/SellerReviews";
import Profile from "./pages/Profile";
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

function LegacySellRouteRedirect() {
  return <Navigate to="/seller/products/new" replace />;
}

function LegacyHelpRedirect() {
  return <Navigate to="/faq" replace />;
}

function LegacySupportRedirect() {
  return <Navigate to="/messages" replace />;
}

function LegacyContactRedirect() {
  return <Navigate to="/about" replace />;
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
      { path: "design-system", Component: DesignSystem },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "verify-otp", Component: VerifyOTP },
      { path: "products", Component: Products },
      { path: "products/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: Checkout },
      { path: "orders", Component: Orders },
      { path: "orders/:id", Component: OrderDetail },
      { path: "messages", Component: Messages },
      { path: "messages/:id", Component: Chat },
      { path: "seller/dashboard", Component: SellerDashboard },
      { path: "seller/products", Component: SellerProducts },
      { path: "seller/products/new", Component: AddProduct },
      { path: "seller/products/add", Component: LegacySellRouteRedirect },
      { path: "seller/products/:id/edit", Component: AddProduct },
      { path: "seller/bank-details", Component: BankDetails },
      { path: "seller/verification", Component: SellerVerification },
      { path: "seller/advertise", Component: Advertise },
      { path: "seller/advertise/setup", Component: SetupAd },
      { path: "reviews/:orderId", Component: WriteReview },
      { path: "seller/:id/reviews", Component: SellerReviews },
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
      { path: "admin/orders", Component: LegacyAdminRedirect },
      { path: "admin/reports", Component: LegacyAdminRedirect },
      { path: "help", Component: LegacyHelpRedirect },
      { path: "support", Component: LegacySupportRedirect },
      { path: "contact", Component: LegacyContactRedirect },
      { path: "*", Component: NotFound },
    ],
  },
]);
