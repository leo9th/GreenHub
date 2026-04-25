export function ensureMessageNotificationPermission(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function showDesktopNotification(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: tag ?? "gh-msg", icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

export function showDesktopMessageNotification(title: string, body: string, tag?: string) {
  showDesktopNotification(title, body, tag);
}
