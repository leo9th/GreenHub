import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fetchConversationsForInbox,
  otherPartyUserId,
  type ConversationListRow,
} from "../utils/chatConversations";
import { fetchInboxUnreadByConversation } from "../utils/engagement";
import { useInboxNotifications } from "../context/InboxNotificationsContext";
import { formatGreenHubRelative } from "../utils/formatGreenHubTime";

export type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
};

export type ConversationRow = ConversationListRow;

export function formatListTime(iso: string | null): string {
  if (!iso) return "";
  return formatGreenHubRelative(iso);
}

export function useInboxConversationList(authUserId: string | undefined) {
  const { refresh: refreshGlobalInbox } = useInboxNotifications();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [productTitles, setProductTitles] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadByConv, setUnreadByConv] = useState<Map<string, number>>(new Map());
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setLoading(Boolean(authUserId));
  }, [authUserId]);

  const load = useCallback(async () => {
    if (!authUserId) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (!hasLoadedOnceRef.current) setLoading(true);
    setLoadError(null);
    try {
      const { data: list, error: convErr } = await fetchConversationsForInbox(supabase, authUserId);
      if (convErr) throw new Error(convErr.message);

      setRows(list);

      const otherIds = [
        ...new Set(
          list
            .map((r) => otherPartyUserId(r, authUserId))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (otherIds.length === 0) {
        setProfiles(new Map());
        setProductTitles(new Map());
        return;
      }

      let profs: ProfileLite[] | null = null;
      let pErr: { message: string } | null = null;

      const pub = await supabase
        .from("profiles_public")
        .select("id, full_name, avatar_url, gender")
        .in("id", otherIds);

      if (!pub.error && pub.data) {
        profs = pub.data as ProfileLite[];
      } else {
        const fallback = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, gender")
          .in("id", otherIds);
        if (fallback.error) pErr = { message: fallback.error.message };
        else profs = (fallback.data ?? []) as ProfileLite[];
      }

      if (pErr) throw new Error(pErr.message);

      const map = new Map<string, ProfileLite>();
      for (const p of profs ?? []) {
        if (p.id) map.set(p.id, p);
      }
      setProfiles(map);

      const productIds = [
        ...new Set(
          list
            .map((r) => r.context_product_id)
            .filter((id): id is number => id != null && Number.isFinite(id)),
        ),
      ];
      if (productIds.length === 0) {
        setProductTitles(new Map());
      } else {
        const pq = await supabase.from("products").select("id, title").in("id", productIds);
        if (!pq.error && pq.data) {
          const pm = new Map<number, string>();
          for (const row of pq.data as { id: number | string; title: string }[]) {
            const id = typeof row.id === "number" ? row.id : Number(row.id);
            if (Number.isFinite(id)) pm.set(id, row.title || "Listing");
          }
          setProductTitles(pm);
        } else {
          setProductTitles(new Map());
        }
      }
    } catch (e: unknown) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "Could not load conversations");
      setRows([]);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId) {
      setUnreadByConv(new Map());
      return;
    }
    let cancelled = false;
    void fetchInboxUnreadByConversation(supabase).then((map) => {
      if (!cancelled) setUnreadByConv(map);
    });
    return () => {
      cancelled = true;
    };
  }, [authUserId, rows]);

  useEffect(() => {
    if (!authUserId) return;
    const uid = authUserId;
    const bump = () => {
      void load();
      void refreshGlobalInbox();
    };
    const ch1 = supabase
      .channel(`messages-list-buyer:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${uid}` },
        bump,
      )
      .subscribe();
    const ch2 = supabase
      .channel(`messages-list-seller:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${uid}` },
        bump,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch1);
      void supabase.removeChannel(ch2);
    };
  }, [authUserId, load, refreshGlobalInbox]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !authUserId) return rows;
    return rows.filter((r) => {
      const oid = otherPartyUserId(r, authUserId);
      if (!oid) return false;
      const p = profiles.get(oid);
      const name = (p?.full_name || "").toLowerCase();
      const prev = (r.last_message || "").toLowerCase();
      const pt =
        r.context_product_id != null ? (productTitles.get(r.context_product_id) || "").toLowerCase() : "";
      return name.includes(q) || prev.includes(q) || pt.includes(q);
    });
  }, [rows, search, authUserId, profiles, productTitles]);

  return {
    search,
    setSearch,
    rows,
    profiles,
    productTitles,
    loading,
    loadError,
    unreadByConv,
    filtered,
    load,
    otherPartyUserId: (r: ConversationRow) => (authUserId ? otherPartyUserId(r, authUserId) : null),
  };
}
