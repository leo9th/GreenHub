import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import { ArrowLeft, Send, MoreVertical, Phone, Plus, Paperclip, Check, CheckCheck } from "lucide-react";
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
        .select("full_name, avatar_url, gender")
        .eq("id", peer)
        .maybeSingle();
      if (!pub.error && pub.data) prof = pub.data as Record<string, unknown>;
      else {
        const fb = await supabase
          .from("profiles")
          .select("full_name, avatar_url, gender")
          .eq("id", peer)
          .maybeSingle();
        if (!fb.error && fb.data) prof = fb.data as Record<string, unknown>;
      }

      if (prof) {
        const name = (prof.full_name as string)?.trim() || "Member";
        setPeerName(name);
        setPeerAvatar(getAvatarUrl(prof.avatar_url as string | null, prof.gender as string | null, name));
        setPeerPhone(null);
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
      toast.error(e instanceof Error ? e.message : "Message not sent");
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="relative flex-shrink-0">
              <img
                src={peerAvatar || getAvatarUrl(null, null, peerName)}
                alt=""
                className="w-10 h-10 rounded-full object-cover bg-gray-100"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-800">{peerName}</h1>
              <p className="text-xs text-gray-600">Direct message</p>
            </div>
            {peerPhone ? (
              <a href={`tel:${peerPhone.replace(/\s/g, "")}`} className="p-2" aria-label="Call">
                <Phone className="w-5 h-5 text-gray-600" />
              </a>
            ) : (
              <button type="button" className="p-2 opacity-40 cursor-not-allowed" aria-hidden>
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button type="button" className="p-2 opacity-50 cursor-not-allowed" aria-hidden>
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-6xl mx-auto w-full">
        {stripProduct ? (
          <div className="mb-4 rounded-2xl bg-white border border-gray-200 shadow-sm p-3 flex gap-3 items-center">
            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
              {stripProduct.image ? (
                <img src={stripProduct.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No image</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{stripProduct.title}</p>
              <p className="text-sm font-bold text-[#16a34a] mt-0.5">{formatPrice(stripProduct.price)}</p>
              <Link
                to={`/products/${stripProduct.id}`}
                className="inline-block mt-1 text-xs font-semibold text-[#16a34a] hover:underline"
              >
                View product
              </Link>
            </div>
          </div>
        ) : null}

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
                    mine ? "bg-[#22c55e] text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  <div className={`flex items-center gap-1.5 mt-1 ${mine ? "justify-end" : ""}`}>
                    <span className={`text-xs ${mine ? "text-white/80" : "text-gray-500"}`}>{timeLabel}</span>
                    {mine ? (
                      <span className="text-white/90 inline-flex items-center" title={readByPeer ? "Read" : "Delivered"}>
                        {readByPeer ? <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {peerTyping ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 inline-flex items-center gap-2">
                <span className="typing-dots flex gap-1" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs">{peerFirstName} is typing…</span>
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="px-3 py-3 max-w-6xl mx-auto">
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 shrink-0"
              aria-label="More"
              disabled
            >
              <Plus className="w-5 h-5 opacity-50" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 shrink-0"
              aria-label="Attach"
              disabled
            >
              <Paperclip className="w-5 h-5 opacity-50" />
            </button>
            <div className="flex-1 relative">
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
                className="w-full px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!message.trim() || sendBusy}
              className="p-2.5 bg-[#22c55e] rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
