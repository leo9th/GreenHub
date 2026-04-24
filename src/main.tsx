import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { RegionProvider } from "./app/context/RegionContext";
import { AuthProvider } from "./app/context/AuthContext";
import { CartProvider } from "./app/context/CartContext";
import { InboxNotificationsProvider } from "./app/context/InboxNotificationsContext";
import { ThemeProvider } from "./app/context/ThemeContext";
import { NotificationProvider } from "./app/context/NotificationProvider";
import { ThemedToaster } from "./app/components/ThemedToaster";
import { AppErrorBoundary } from "./app/components/errors/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary scope="global">
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <InboxNotificationsProvider>
            <RegionProvider>
              <CartProvider>
                <App />
                <ThemedToaster />
              </CartProvider>
            </RegionProvider>
          </InboxNotificationsProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </AppErrorBoundary>
);