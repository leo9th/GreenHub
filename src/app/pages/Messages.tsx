import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Search, MessageCircle } from "lucide-react";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  fetchConversationsForInbox,
  otherPartyUserId,
  type ConversationListRow,
} from "../utils/chatConversations";
import { fetchInboxUnreadByConversation } from "../utils/engagement";
import { useInboxNotifications } from "../context/InboxNotificationsContext";

/** Inbox row: `buyer_id` + `seller_id` (+ preview fields). */
type ConversationRow = ConversationListRow;

type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
};

function formatListTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 * 2) return "Yesterday";
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Messages() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { refresh: refreshGlobalInbox } = useInboxNotifications();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [productTitles, setProductTitles] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadByConv, setUnreadByConv] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    if (!authUser?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data: list, error: convErr } = await fetchConversationsForInbox(supabase, authUser.id);
      if (convErr) throw new Error(convErr.message);

      setRows(list);

      const otherIds = [
        ...new Set(
          list
            .map((r) => otherPartyUserId(r, authUser.id))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (otherIds.length === 0) {
        setProfiles(new Map());
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
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) {
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
  }, [authUser?.id, rows]);

  useEffect(() => {
    if (!authUser?.id) return;
    const uid = authUser.id;
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
  }, [authUser?.id, load, refreshGlobalInbox]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !authUser?.id) return rows;
    return rows.filter((r) => {
      const oid = otherPartyUserId(r, authUser.id);
      if (!oid) return false;
      const p = profiles.get(oid);
      const name = (p?.full_name || "").toLowerCase();
      const prev = (r.last_message || "").toLowerCase();
      const pt =
        r.context_product_id != null ? (productTitles.get(r.context_product_id) || "").toLowerCase() : "";
      return name.includes(q) || prev.includes(q) || pt.includes(q);
    });
  }, [rows, search, authUser?.id, profiles, productTitles]);

  if (authLoading || (!authUser && !loadError)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Messages</h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {loadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-600">{loadError}</div>
        ) : loading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-600">Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No messages yet</h3>
            <p className="text-gray-600 text-sm mb-6">
              Start chatting with sellers about products you&apos;re interested in
            </p>
            <Link to="/products" className="inline-block px-6 py-3 bg-[#22c55e] text-white rounded-lg font-medium">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((conversation) => {
              if (!authUser) return null;
              const oid = otherPartyUserId(conversation, authUser.id);
              if (!oid) return null;
              const p = profiles.get(oid);
              const name = p?.full_name?.trim() || "Member";
              const avatar = getAvatarUrl(p?.avatar_url ?? null, p?.gender ?? null, name);
              const aboutProduct =
                conversation.context_product_id != null
                  ? productTitles.get(conversation.context_product_id)
                  : undefined;
              return (
                <Link
                  key={conversation.id}
                  to={`/messages/c/${conversation.id}`}
                  className="flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <img src={avatar} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <h3 className="font-semibold text-gray-800">{name}</h3>
                      <span className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {(unreadByConv.get(conversation.id) ?? 0) > 0 ? (
                          <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-[#22c55e] text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadByConv.get(conversation.id)! > 99 ? "99+" : unreadByConv.get(conversation.id)}
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {formatListTime(conversation.last_message_at)}
                        </span>
                      </span>
                    </div>
                    {aboutProduct ? (
                      <p className="text-xs text-[#16a34a] font-medium truncate mb-0.5">Re: {aboutProduct}</p>
                    ) : null}
                    <p className={`text-sm line-clamp-2 ${conversation.last_message ? "text-gray-700" : "text-gray-400 italic"}`}>
                      {conversation.last_message || "No messages yet — say hello"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
