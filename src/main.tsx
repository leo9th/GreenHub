import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { RegionProvider } from "./app/context/RegionContext";
import { Toaster } from "sonner";
import { AuthProvider } from "./app/context/AuthContext";
import { CartProvider } from "./app/context/CartContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <RegionProvider>
      <CartProvider>
        <App />
        <Toaster position="top-center" richColors />
      </CartProvider>
    </RegionProvider>
  </AuthProvider>
);