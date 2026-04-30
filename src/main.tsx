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

function reportBootstrapError(kind: "error" | "unhandledrejection", errorText: string) {
  console.error(`[bootstrap ${kind}]`, errorText);
}

window.addEventListener("error", (event) => {
  reportBootstrapError("error", event.message || "Unknown window error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    typeof event.reason === "string"
      ? event.reason
      : event.reason instanceof Error
        ? event.reason.message
        : JSON.stringify(event.reason ?? "Unknown rejection");
  reportBootstrapError("unhandledrejection", reason);
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  reportBootstrapError("error", "Missing #root element");
  throw new Error("Missing #root element.");
}

try {
  createRoot(rootEl).render(
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
} catch (error) {
  const errorText = error instanceof Error ? error.message : String(error);
  reportBootstrapError("error", errorText);
  rootEl.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;padding:24px;text-align:center;color:#111827;font:500 14px/1.5 system-ui,sans-serif;">App failed to initialize. Please refresh the page.</div>';
}