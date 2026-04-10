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
import { ensureMessageNotificationPermission, showDesktopMessageNotification } from "../utils/browserNotify";

type InboxNotificationsContextValue = {
  messageUnread: number;
  notifications: AppNotificationRow[];
  notificationUnreadCount: number;
  refresh: () => Promise<void>;
  markAllNotificationsReadAndRefresh: () => Promise<void>;
};

const InboxNotificationsContext = createContext<InboxNotificationsContextValue | null>(null);

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
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const onNotifEvent = (payload: { eventType?: string; new?: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT" && payload.new) {
        const row = payload.new as AppNotificationRow;
        if (row.type === "message") {
          showDesktopMessageNotification(row.title || "New message", row.body || "", row.id);
        }
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
    if (!user?.id) return;
    await markAllNotificationsRead(supabase, user.id);
    await refresh();
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
      markAllNotificationsReadAndRefresh: async () => {},
    };
  }
  return ctx;
}
