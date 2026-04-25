import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import {
  fetchRecentNotifications,
  fetchTotalUnreadMessages,
  markAllNotificationsRead,
  type AppNotificationRow,
} from "../utils/engagement";
import { ensureMessageNotificationPermission, showDesktopNotification } from "../utils/browserNotify";
import {
  playNotificationSound,
  setNotificationSoundEnabled,
  unlockNotificationAudio,
} from "../utils/soundNotifications";

type InboxNotificationsContextValue = {
  messageUnread: number;
  notifications: AppNotificationRow[];
  notificationUnreadCount: number;
  refresh: () => Promise<void>;
  markAllNotificationsReadAndRefresh: () => Promise<{ error: string | null }>;
};

const InboxNotificationsContext = createContext<InboxNotificationsContextValue | null>(null);

function fallbackNotificationTitle(type: string): string {
  switch (type) {
    case "message":
      return "New message";
    case "order_placed":
    case "order":
      return "New order placed";
    case "delivery_status_changed":
    case "delivery":
      return "Delivery update";
    case "delivery_job_assigned":
      return "New delivery assignment";
    case "payment_received":
    case "payment":
      return "Payment received";
    case "weekend_greeting":
    case "promotion":
      return "GreenHub reminder";
    case "birthday_greeting":
    case "birthday":
      return "Birthday greeting";
    default:
      return "Notification";
  }
}

export function InboxNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messageUnread, setMessageUnread] = useState(0);
  const [notifications, setNotifications] = useState<AppNotificationRow[]>([]);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setMessageUnread(0);
      setNotifications([]);
      return;
    }
    const [count, list] = await Promise.all([
      fetchTotalUnreadMessages(supabase),
      fetchRecentNotifications(supabase),
    ]);
    setMessageUnread(count);
    setNotifications(list);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    ensureMessageNotificationPermission();
    unlockNotificationAudio();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotificationSoundEnabled(true);
      return;
    }
    const uid = user.id;
    let alive = true;
    const loadSoundPreference = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("sound_notifications")
        .eq("id", uid)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setNotificationSoundEnabled(true);
        return;
      }
      const enabled = (data as { sound_notifications?: boolean } | null)?.sound_notifications;
      setNotificationSoundEnabled(enabled !== false);
    };
    void loadSoundPreference();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const onNotifEvent = (payload: { eventType?: string; new?: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT" && payload.new) {
        const row = payload.new as AppNotificationRow;
        showDesktopNotification(
          row.title || fallbackNotificationTitle(row.type),
          row.body || "",
          row.id ?? `gh-${row.type}`,
        );
        playNotificationSound(row.type);
      }
      void refresh();
    };

    const notifCh = supabase
      .channel(`realtime-notifications:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        onNotifEvent,
      )
      .subscribe();

    const convBuyer = supabase
      .channel(`realtime-conv-buyer:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${uid}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const convSeller = supabase
      .channel(`realtime-conv-seller:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${uid}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(notifCh);
      void supabase.removeChannel(convBuyer);
      void supabase.removeChannel(convSeller);
    };
  }, [user?.id, refresh]);

  const markAllNotificationsReadAndRefresh = useCallback(async () => {
    if (!user?.id) return { error: null };
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at == null ? { ...n, read_at: now } : n)),
    );
    const { error } = await markAllNotificationsRead(supabase, user.id);
    if (error) {
      console.warn("markAllNotificationsRead:", error);
      await refresh();
      return { error };
    }
    await refresh();
    return { error: null };
  }, [user?.id, refresh]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => n.read_at == null).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      messageUnread,
      notifications,
      notificationUnreadCount,
      refresh,
      markAllNotificationsReadAndRefresh,
    }),
    [messageUnread, notifications, notificationUnreadCount, refresh, markAllNotificationsReadAndRefresh],
  );

  return (
    <InboxNotificationsContext.Provider value={value}>{children}</InboxNotificationsContext.Provider>
  );
}

export function useInboxNotifications(): InboxNotificationsContextValue {
  const ctx = useContext(InboxNotificationsContext);
  if (!ctx) {
    return {
      messageUnread: 0,
      notifications: [],
      notificationUnreadCount: 0,
      refresh: async () => {},
      markAllNotificationsReadAndRefresh: async () => ({ error: null }),
    };
  }
  return ctx;
}
