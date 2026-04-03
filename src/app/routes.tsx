import { createBrowserRouter, Navigate } from "react-router";
import ProfileEdit from "./pages/ProfileEdit";
import Login from "./pages/Login";
import AddProduct from "./pages/seller/AddProduct";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/profile/edit" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/profile", element: <Navigate to="/profile/edit" replace /> },
  { path: "/profile/edit", element: <ProfileEdit /> },
  { path: "/seller/products/new", element: <AddProduct /> },
  { path: "/seller/products/add", element: <Navigate to="/seller/products/new" replace /> },
]);
