import { createBrowserRouter } from "react-router";
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
import WriteReview from "./pages/WriteReview";
import SellerReviews from "./pages/SellerReviews";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProducts from "./pages/admin/Products";
import AdPricingControl from "./pages/admin/AdPricingControl";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "about", Component: About },
      { path: "apply", Component: ApplyJob },
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
      { path: "seller/products/:id/edit", Component: AddProduct },
      { path: "seller/bank-details", Component: BankDetails },
      { path: "seller/advertise", Component: Advertise },
      { path: "seller/advertise/setup", Component: SetupAd },
      { path: "reviews/:orderId", Component: WriteReview },
      { path: "seller/:id/reviews", Component: SellerReviews },
      { path: "profile", Component: Profile },
      { path: "settings/profile/edit", Component: ProfileEdit },
      { path: "settings", Component: Settings },
      { path: "admin/dashboard", Component: AdminDashboard },
      { path: "admin/users", Component: AdminUsers },
      { path: "admin/products", Component: AdminProducts },
      { path: "admin/pricing", Component: AdPricingControl },
      { path: "*", Component: NotFound },
    ],
  },
]);
