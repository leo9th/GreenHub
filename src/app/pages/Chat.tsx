import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Phone,
  Plus,
  Paperclip,
  Check,
  CheckCheck,
  MessageCircle,
  Search,
  User,
  Settings,
  Link2,
} from "lucide-react";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useCurrency } from "../hooks/useCurrency";
import { getProductPrice } from "../utils/getProductPrice";
import {
  findConversationByPair,
  fetchConversationById,
  insertConversationPair,
  otherPartyUserId,
  updateConversationLastRead,
  setConversationContextProduct,
  isOutgoingReadByPeer,
  type ConversationRow,
} from "../utils/chatConversations";
import { fetchChatMessagesForConversation, type ChatMessageRow } from "../utils/chatMessages";
import { formatListTime, useInboxConversationList } from "../hooks/useInboxConversationList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

function parseConversationInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isDuplicateConversationError(err: { code?: string; message?: string }): boolean {
  const c = String(err.code ?? "");
  const m = String(err.message ?? "").toLowerCase();
  return (
    c === "23505" ||
    m.includes("duplicate") ||
    m.includes("unique") ||
    m.includes("conversations_pair")
  );
}

/** Build tel / WhatsApp links from a profile phone string (WhatsApp uses digits only, with simple NG 0→234 normalization). */
function phoneLinkTargets(raw: string | null): { telHref: string; waHref: string } | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const telHref = trimmed.includes("+")
    ? `tel:${trimmed.replace(/\s/g, "")}`
    : `tel:${digits}`;
  let waDigits = digits;
  if (!waDigits.startsWith("234") && waDigits.startsWith("0") && waDigits.length >= 10 && waDigits.length <= 11) {
    waDigits = `234${waDigits.slice(1)}`;
  }
  const waHref = `https://wa.me/${waDigits}`;
  return { telHref, waHref };
}

/** PostgREST / Supabase errors are plain objects with `message`, not always `Error` instances. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

type StripProduct = {
  id: number;
  title: string;
  price: number;
  image: string | null;
};

export default function Chat() {
  const { conversationId: threadIdParam, peerUserId: peerRouteParam, legacyThreadId } = useParams<{
    conversationId?: string;
    peerUserId?: string;
    legacyThreadId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const formatPrice = useCurrency();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Member");
  const [peerAvatar, setPeerAvatar] = useState<string>("");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [stripProduct, setStripProduct] = useState<StripProduct | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    search: inboxSearch,
    setSearch: setInboxSearch,
    loadError: inboxLoadError,
    loading: inboxLoading,
    filtered: inboxFiltered,
    profiles: inboxProfiles,
    productTitles: inboxProductTitles,
    unreadByConv: inboxUnreadByConv,
    load: loadInboxList,
    otherPartyUserId: inboxOtherPartyUserId,
  } = useInboxConversationList(authUser?.id);

  const productParam = searchParams.get("product");
  const validProductId = useMemo(() => {
    if (!productParam) return null;
    const n = parseInt(productParam, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [productParam]);

  const peerFirstName = useMemo(() => peerName.split(/\s+/)[0] || "Member", [peerName]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerTyping]);

  const resolveConversation = useCallback(async () => {
    const threadId = threadIdParam?.trim() ?? legacyThreadId?.trim();
    const peerFromUrl = peerRouteParam?.trim();

    if (!authUser?.id || (!threadId && !peerFromUrl)) {
      setConversation(null);
      setLoadError(threadId || peerFromUrl ? null : "Invalid chat link. Open a thread from Messages or Message seller.");
      setLoading(false);
      return;
    }

    if (threadId && peerFromUrl) {
      setLoadError("Invalid chat URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const me = authUser.id;
      let conv: ConversationRow | null = null;
      let peer: string | null = null;

      if (threadId) {
        const { data: byId, error: errConv } = await fetchConversationById(supabase, threadId);
        if (errConv) throw new Error(errConv.message);
        if (!byId) {
          setLoadError(
            "This conversation was not found or you don’t have access. Sign in as the buyer or seller on this thread and check Supabase RLS on `conversations` (select allowed when auth.uid() is buyer_id or seller_id).",
          );
          setConversation(null);
          setPeerId(null);
          setLoading(false);
          return;
        }
        conv = byId;
        peer = otherPartyUserId(conv, me);
        if (!peer) {
          setLoadError("Your account is not the buyer or seller on this conversation.");
          setConversation(null);
          setPeerId(null);
          setLoading(false);
          return;
        }
        if (validProductId) {
          const { error: uErr } = await setConversationContextProduct(supabase, conv.id, validProductId);
          if (!uErr) conv = { ...conv, context_product_id: validProductId };
        }
      } else if (peerFromUrl) {
        if (peerFromUrl === me) {
          setLoadError("You can't start a chat with yourself.");
          setConversation(null);
          setLoading(false);
          return;
        }

        let found = await findConversationByPair(supabase, me, peerFromUrl);
        if (!found) {
          const { data: inserted, error: insErr } = await insertConversationPair(
            supabase,
            me,
            peerFromUrl,
            validProductId ? { contextProductId: validProductId } : undefined,
          );
          if (insErr) {
            if (isDuplicateConversationError(insErr)) {
              found = await findConversationByPair(supabase, me, peerFromUrl);
              if (!found) throw new Error(insErr.message);
              conv = found;
              if (validProductId) {
                const { error: uErr } = await setConversationContextProduct(supabase, conv.id, validProductId);
                if (!uErr) conv = { ...conv, context_product_id: validProductId };
              }
            } else {
              throw new Error(insErr.message);
            }
          } else {
            conv = inserted;
          }
        } else {
          conv = found;
          if (validProductId) {
            const { error: uErr } = await setConversationContextProduct(supabase, found.id, validProductId);
            if (!uErr) conv = { ...conv, context_product_id: validProductId };
          }
        }
        peer = peerFromUrl;
        if (conv && !threadIdParam && !legacyThreadId) {
          navigate(`/messages/c/${conv.id}`, { replace: true });
        }
      }

      if (!conv || !peer) {
        setLoadError("Chat could not be opened.");
        setConversation(null);
        setPeerId(null);
        setLoading(false);
        return;
      }

      setConversation(conv);
      setPeerId(peer);

      let prof: Record<string, unknown> | null = null;
      const pub = await supabase
        .from("profiles_public")
        .select("full_name, avatar_url, gender, phone")
        .eq("id", peer)
        .maybeSingle();
      if (!pub.error && pub.data) prof = pub.data as Record<string, unknown>;
      else {
        const fb = await supabase
          .from("profiles")
          .select("full_name, avatar_url, gender, phone")
          .eq("id", peer)
          .maybeSingle();
        if (!fb.error && fb.data) prof = fb.data as Record<string, unknown>;
      }

      if (prof) {
        const name = (prof.full_name as string)?.trim() || "Member";
        setPeerName(name);
        setPeerAvatar(getAvatarUrl(prof.avatar_url as string | null, prof.gender as string | null, name));
        const phoneRaw = prof.phone;
        setPeerPhone(typeof phoneRaw === "string" && phoneRaw.trim() ? phoneRaw.trim() : null);
      } else {
        setPeerName("Member");
        setPeerAvatar(getAvatarUrl(null, null, "Member"));
        setPeerPhone(null);
      }

      const { data: msgs, error: mErr } = await fetchChatMessagesForConversation(supabase, conv.id);
      if (mErr) throw new Error(mErr.message);
      setMessages(msgs);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Could not open chat";
      setLoadError(
        msg.includes("relation") && msg.includes("does not exist")
          ? "Messaging tables are not set up yet. Run the Supabase migration for conversations and chat_messages."
          : msg.includes("context_product_id") || msg.includes("buyer_last_read_at")
            ? "Run the latest messaging migration (context product + read receipts) on your Supabase project."
            : msg,
      );
      toast.error(msg);
      setConversation(null);
      setPeerId(null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, threadIdParam, peerRouteParam, legacyThreadId, validProductId, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void resolveConversation();
  }, [authLoading, authUser, navigate, resolveConversation]);

  useEffect(() => {
    if (authLoading || !authUser?.id) return;
    void loadInboxList();
  }, [authLoading, authUser?.id, loadInboxList]);

  useEffect(() => {
    const pid = conversation?.context_product_id;
    if (!pid) {
      setStripProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, price_local, image")
        .eq("id", pid)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setStripProduct(null);
        return;
      }
      const row = data as Record<string, unknown>;
      setStripProduct({
        id: Number(row.id),
        title: String(row.title ?? "Listing"),
        price: getProductPrice(row as { price?: unknown; price_local?: unknown }),
        image: typeof row.image === "string" ? row.image : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.context_product_id]);

  useEffect(() => {
    if (!conversation?.id || !authUser?.id) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const { error } = await updateConversationLastRead(supabase, conversation, authUser.id);
        if (error) return;
        void supabase.rpc("mark_message_notifications_read", { p_conversation_id: conversation.id });
        const now = new Date().toISOString();
        setConversation((c) =>
          c
            ? {
                ...c,
                buyer_last_read_at: c.buyer_id === authUser.id ? now : c.buyer_last_read_at,
                seller_last_read_at: c.seller_id === authUser.id ? now : c.seller_last_read_at,
              }
            : c,
        );
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [conversation?.id, authUser?.id, messages.length]);

  useEffect(() => {
    if (!conversation?.id) return;
    const mid = conversation.id;

    const msgChannel = supabase
      .channel(`chat-inserts:${mid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${mid}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    const convChannel = supabase
      .channel(`chat-conv:${mid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${mid}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          setConversation((c) => {
            if (!c) return c;
            const pid = next.context_product_id;
            return {
              ...c,
              context_product_id:
                pid !== undefined && pid !== null ? parseConversationInt(pid) : c.context_product_id,
              buyer_last_read_at: (next.buyer_last_read_at as string | null | undefined) ?? c.buyer_last_read_at,
              seller_last_read_at: (next.seller_last_read_at as string | null | undefined) ?? c.seller_last_read_at,
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(convChannel);
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id || !authUser?.id) return;
    const ch = supabase.channel(`chat-typing:${conversation.id}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, (p) => {
      const payload = p.payload as { userId?: string };
      if (payload?.userId === authUser.id) return;
      setPeerTyping(true);
      if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
      peerTypingClearRef.current = setTimeout(() => setPeerTyping(false), 2800);
    });
    typingChannelRef.current = null;
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") typingChannelRef.current = ch;
    });
    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(ch);
      if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
    };
  }, [conversation?.id, authUser?.id]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !authUser?.id) return;
    void typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: authUser.id },
    });
  }, [authUser?.id]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !authUser?.id || !conversation) return;

    setSendBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: authUser.id,
          message: text,
        })
        .select("id, sender_id, message, created_at")
        .single();

      if (error) throw error;
      if (inserted) setMessages((prev) => [...prev, inserted as ChatMessageRow]);
      setMessage("");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Message not sent"));
    } finally {
      setSendBusy(false);
    }
  };

  const onComposerChange = (v: string) => {
    setMessage(v);
    if (typingBroadcastRef.current) clearTimeout(typingBroadcastRef.current);
    typingBroadcastRef.current = setTimeout(() => {
      if (v.trim()) broadcastTyping();
    }, 600);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (!authUser || !conversation || !peerId) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 text-center pb-8">
        <p className="text-gray-800 font-medium mb-2">Chat could not be loaded.</p>
        {loadError ? <p className="text-sm text-gray-600 max-w-md mb-4">{loadError}</p> : null}
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-medium"
        >
          Back to messages
        </button>
      </div>
    );
  }

  const peerContactLinks = phoneLinkTargets(peerPhone);

  const chatPanel = (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
      <header className="sticky top-16 z-40 shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 max-md:py-4">
          <div className="mb-1 flex items-center gap-3 max-md:mb-1.5">
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="-ml-2 rounded-lg p-2 hover:bg-gray-100 md:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div className="relative shrink-0">
              <img
                src={peerAvatar || getAvatarUrl(null, null, peerName)}
                alt=""
                className="h-10 w-10 rounded-full bg-gray-100 object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-gray-800">{peerName}</h1>
              <p className="text-xs text-gray-600">Direct message</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  aria-label="Call or WhatsApp"
                >
                  <Phone className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Contact</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {peerContactLinks ? (
                  <>
                    <DropdownMenuItem asChild>
                      <a href={peerContactLinks.telHref}>Voice call</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={peerContactLinks.waHref} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    disabled
                    className="whitespace-normal text-xs font-normal text-gray-500"
                  >
                    No phone number — they can share one by enabling phone on their profile.
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  aria-label="Chat settings"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${peerId}`} className="flex cursor-pointer items-center gap-2">
                    <User className="h-4 w-4" />
                    View profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Account and notification settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex cursor-pointer items-center gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    const url = `${window.location.origin}/messages/c/${conversation.id}`;
                    void navigator.clipboard.writeText(url).then(
                      () => toast.success("Conversation link copied"),
                      () => toast.error("Could not copy link"),
                    );
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  Copy conversation link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            const mine = msg.sender_id === authUser.id;
            const t = new Date(msg.created_at);
            const timeLabel = Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            const readByPeer = mine && isOutgoingReadByPeer(conversation, authUser.id, msg.created_at);
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    mine ? "rounded-br-sm bg-[#22c55e] text-white" : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.message}</p>
                  <div className={`mt-1 flex items-center gap-1.5 ${mine ? "justify-end" : ""}`}>
                    <span className={`text-xs ${mine ? "text-white/80" : "text-gray-500"}`}>{timeLabel}</span>
                    {mine ? (
                      <span className="inline-flex items-center text-white/90" title={readByPeer ? "Read" : "Delivered"}>
                        {readByPeer ? <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {peerTyping ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
                <span className="typing-dots flex gap-1" aria-hidden>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </span>
                <span className="text-xs">{peerFirstName} is typing…</span>
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="px-3 py-3">
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="More"
              disabled
            >
              <Plus className="h-5 w-5 opacity-50" />
            </button>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Attach"
              disabled
            >
              <Paperclip className="h-5 w-5 opacity-50" />
            </button>
            <div className="relative flex-1">
              <textarea
                value={message}
                onChange={(e) => onComposerChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none rounded-full bg-gray-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!message.trim() || sendBusy}
              className="shrink-0 rounded-full bg-[#22c55e] p-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const shellHeight = "md:h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

  const conversationList = (
    <>
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-800">Messages</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={inboxSearch}
            onChange={(e) => setInboxSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg bg-gray-100 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        {inboxLoadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-600">{inboxLoadError}</div>
        ) : inboxLoading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-600">Loading conversations…</div>
        ) : inboxFiltered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <MessageCircle className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800">No messages yet</h3>
            <p className="mb-6 text-sm text-gray-600">
              Start chatting with sellers about products you&apos;re interested in
            </p>
            <Link
              to="/products"
              className="inline-block rounded-lg bg-[#22c55e] px-6 py-3 font-medium text-white"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inboxFiltered.map((row) => {
              const oid = inboxOtherPartyUserId(row);
              if (!oid) return null;
              const p = inboxProfiles.get(oid);
              const name = p?.full_name?.trim() || "Member";
              const avatar = getAvatarUrl(p?.avatar_url ?? null, p?.gender ?? null, name);
              const aboutProduct =
                row.context_product_id != null ? inboxProductTitles.get(row.context_product_id) : undefined;
              const active = conversation.id === row.id;
              return (
                <Link
                  key={row.id}
                  to={`/messages/c/${row.id}`}
                  className={`flex items-center gap-3 border-b border-gray-50 p-3 transition-colors hover:bg-gray-50 sm:p-4 ${
                    active ? "bg-emerald-50/80 hover:bg-emerald-50" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={avatar} alt="" className="h-12 w-12 rounded-full bg-gray-100 object-cover sm:h-14 sm:w-14" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800">{name}</h3>
                      <span className="ml-2 flex shrink-0 items-center gap-1.5">
                        {(inboxUnreadByConv.get(row.id) ?? 0) > 0 ? (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#22c55e] px-1 text-[10px] font-bold text-white">
                            {inboxUnreadByConv.get(row.id)! > 99 ? "99+" : inboxUnreadByConv.get(row.id)}
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-500">{formatListTime(row.last_message_at)}</span>
                      </span>
                    </div>
                    {aboutProduct ? (
                      <p className="mb-0.5 truncate text-xs font-medium text-[#16a34a]">Re: {aboutProduct}</p>
                    ) : null}
                    <p
                      className={`line-clamp-2 text-sm ${row.last_message ? "text-gray-700" : "italic text-gray-400"}`}
                    >
                      {row.last_message || "No messages yet — say hello"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const productDetailsAside = stripProduct ? (
    <div className="lg:sticky lg:top-0">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {stripProduct.image ? (
            <img src={stripProduct.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-gray-900">{stripProduct.title}</p>
          <p className="mt-0.5 text-sm font-bold text-[#16a34a]">{formatPrice(stripProduct.price)}</p>
          <Link
            to={`/products/${stripProduct.id}`}
            className="mt-1 inline-block text-xs font-semibold text-[#16a34a] hover:underline"
          >
            View product
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-gray-50 max-md:pt-3">
      <div
        className={`mx-auto grid w-full max-w-[1280px] min-h-[calc(100dvh-4rem)] max-md:min-h-[calc(100dvh-4rem-0.75rem)] grid-cols-1 md:grid-cols-[1fr_2fr] lg:grid-cols-[1fr_2fr_1fr] ${shellHeight}`}
      >
        <aside
          className={`hidden min-h-0 flex-col border-r border-gray-200 bg-white md:flex ${shellHeight}`}
        >
          {conversationList}
        </aside>

        <section className={`flex min-h-0 min-w-0 flex-col ${shellHeight}`}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{chatPanel}</div>
        </section>

        <aside
          className={`hidden min-h-0 flex-col border-l border-gray-200 bg-white p-4 lg:flex ${shellHeight} overflow-y-auto overscroll-contain`}
        >
          {productDetailsAside}
        </aside>
      </div>
    </div>
  );
}
