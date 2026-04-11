import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { RegionProvider } from "./app/context/RegionContext";
import { AuthProvider } from "./app/context/AuthContext";
import { CartProvider } from "./app/context/CartContext";
import { InboxNotificationsProvider } from "./app/context/InboxNotificationsContext";
import { ThemeProvider } from "./app/context/ThemeContext";
import { ThemedToaster } from "./app/components/ThemedToaster";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <InboxNotificationsProvider>
        <RegionProvider>
          <CartProvider>
            <App />
            <ThemedToaster />
          </CartProvider>
        </RegionProvider>
      </InboxNotificationsProvider>
    </AuthProvider>
  </ThemeProvider>
);