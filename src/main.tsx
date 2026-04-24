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
import { initSentry } from "./lib/sentry";

initSentry();
// #region agent log
console.warn("[APPDBG-6af1a9] main.tsx loaded");
// #endregion
// #region agent log
void fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35665f" },
  body: JSON.stringify({
    sessionId: "35665f",
    runId: "run1",
    hypothesisId: "H0",
    location: "main.tsx:startup",
    message: "App mounted (main.tsx entry)",
    data: { env: import.meta.env.MODE },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

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