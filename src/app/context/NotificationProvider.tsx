import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

export type NotificationType =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "message"
  | "order_update"
  | "price_drop"
  | "auth_error";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = persistent
  actionLabel?: string;
  onAction?: () => void;
}

type NotificationContextValue = {
  notify: (payload: NotificationPayload) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  authError: (title: string, message?: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notify = useCallback((payload: NotificationPayload) => {
    const { type, title, message, duration = 4000, actionLabel, onAction } = payload;

    const toastOptions = {
      duration,
      action: actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined,
    };

    switch (type) {
      case "success":
        toast.success(message || title, toastOptions);
        break;
      case "error":
      case "auth_error":
        toast.error(message || title, toastOptions);
        break;
      case "warning":
        toast.warning(message || title, toastOptions);
        break;
      case "info":
      case "message":
      case "order_update":
      case "price_drop":
      default:
        toast(message || title, toastOptions);
        break;
    }
  }, []);

  const success = useCallback(
    (title: string, message?: string) => notify({ type: "success", title, message }),
    [notify]
  );

  const error = useCallback(
    (title: string, message?: string) => notify({ type: "error", title, message }),
    [notify]
  );

  const info = useCallback(
    (title: string, message?: string) => notify({ type: "info", title, message }),
    [notify]
  );

  const warning = useCallback(
    (title: string, message?: string) => notify({ type: "warning", title, message }),
    [notify]
  );

  const authError = useCallback(
    (title: string, message?: string) => notify({ type: "auth_error", title, message }),
    [notify]
  );

  const value: NotificationContextValue = useMemo(
    () => ({
      notify,
      success,
      error,
      info,
      warning,
      authError,
    }),
    [notify, success, error, info, warning, authError]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Hook to use notifications anywhere in the app.
 * Example:
 *   const notif = useNotification();
 *   notif.success("Email sent!");
 *   notif.error("Failed to send email");
 */
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
