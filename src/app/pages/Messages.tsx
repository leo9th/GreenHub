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
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    } catch (e: unknown) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "Could not load conversations");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

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
      return name.includes(q) || prev.includes(q);
    });
  }, [rows, search, authUser?.id, profiles]);

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
              return (
                <Link
                  key={conversation.id}
                  to={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <img src={avatar} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-800">{name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatListTime(conversation.last_message_at)}
                      </span>
                    </div>

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
