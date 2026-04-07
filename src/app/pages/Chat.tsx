import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Phone,
  Paperclip,
  Check,
  CheckCheck,
  MessageCircle,
  Search,
  User,
  Settings,
  Link2,
  Smile,
  Reply,
  Trash2,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { buttonVariants } from "../components/ui/button";

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

const CHAT_EMOJI_GROUPS: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "🤔", "🫤", "😴", "😮", "😢", "😭", "😤", "🥹", "😎", "🤓", "🥳", "🤗", "🫡", "🫠",
    ],
  },
  {
    id: "hearts",
    label: "Love",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💋", "💌", "♥️", "😻", "💑", "💐", "🌹", "🌷",
    ],
  },
  {
    id: "hands",
    label: "Hands",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🫰", "🤝", "🙏", "👏", "🫶", "👋", "🤚", "✋", "💪", "🤙", "👆", "👇", "☝️", "✊", "👊", "🤛", "🤜",
    ],
  },
  {
    id: "celebrate",
    label: "Party",
    emojis: [
      "🎉", "🎊", "✨", "🌟", "⭐", "💫", "🔥", "💯", "🏆", "🥇", "🎯", "✅", "☑️", "👀", "🙌", "💥", "🎁", "🍾", "🥂", "🎂",
    ],
  },
  {
    id: "food",
    label: "Food",
    emojis: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🥭", "🍑", "🥑", "🥕", "🌽", "🥦", "🍞", "🧀", "🍳", "🍔", "🍟", "🍕", "🌮", "🍣", "🍩", "☕", "🧃", "🍷",
    ],
  },
  {
    id: "misc",
    label: "More",
    emojis: [
      "💬", "❓", "❗", "💡", "📌", "📎", "📦", "🛒", "🏠", "🌍", "☀️", "🌧️", "⚡", "🕐", "📱", "💻", "🐶", "🐱", "🌿", "🍀", "🎵", "⚽", "🚗", "✈️", "⛺",
    ],
  },
];

function ChatEmojiPickerContent({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  const group = CHAT_EMOJI_GROUPS[tab] ?? CHAT_EMOJI_GROUPS[0];
  return (
    <div className="w-[min(17.5rem,calc(100vw-2.5rem))] select-none">
      <div className="mb-1.5 flex gap-0.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHAT_EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setTab(i)}
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              i === tab ? "bg-[#22c55e]/15 text-[#15803d]" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-[9.5rem] grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain pr-0.5">
        {group.emojis.map((em, idx) => (
          <button
            key={`${group.id}-${idx}-${em}`}
            type="button"
            onClick={() => onPick(em)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[1.05rem] leading-none hover:bg-gray-100 active:scale-95"
            aria-label={`Insert emoji ${em}`}
          >
            {em}
          </button>
        ))}
      </div>
    </div>
  );
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
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageRow | null>(null);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<ChatMessageRow | null>(null);
  const [clearMineOpen, setClearMineOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
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

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    scrollMessagesToBottom("smooth");
  }, [messages, stripProduct, scrollMessagesToBottom]);

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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${mid}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          const id = oldRow?.id;
          if (!id) return;
          setMessages((prev) => prev.filter((m) => m.id !== id));
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

    const replyId = replyTo?.id ?? null;
    setSendBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: authUser.id,
          message: text,
          ...(replyId ? { reply_to_id: replyId } : {}),
        })
        .select("id, sender_id, message, created_at, reply_to_id")
        .single();

      if (error) throw error;
      if (inserted) setMessages((prev) => [...prev, inserted as ChatMessageRow]);
      setMessage("");
      setReplyTo(null);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Message not sent"));
    } finally {
      setSendBusy(false);
    }
  };

  const executeDeleteMessage = async (msg: ChatMessageRow) => {
    if (!authUser?.id || msg.sender_id !== authUser.id) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase.from("chat_messages").delete().eq("id", msg.id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setReplyTo((r) => (r?.id === msg.id ? null : r));
      setDeleteConfirmMessage(null);
      toast.success("Message removed");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Could not delete message"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const executeClearMyMessages = async () => {
    if (!authUser?.id || !conversation) return;
    const mine = messages.filter((m) => m.sender_id === authUser.id);
    if (mine.length === 0) {
      setClearMineOpen(false);
      return;
    }
    setDeleteBusy(true);
    try {
      const ids = mine.map((m) => m.id);
      const { error } = await supabase.from("chat_messages").delete().in("id", ids);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.sender_id !== authUser.id));
      setReplyTo(null);
      setClearMineOpen(false);
      toast.success(`Removed ${ids.length} message${ids.length === 1 ? "" : "s"}`);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Could not clear your messages"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const onComposerChange = (v: string) => {
    setMessage(v);
    if (typingBroadcastRef.current) clearTimeout(typingBroadcastRef.current);
    typingBroadcastRef.current = setTimeout(() => {
      if (v.trim()) broadcastTyping();
    }, 600);
  };

  const insertEmoji = useCallback((emoji: string) => {
    const el = composerRef.current;
    if (!el) {
      setMessage((m) => m + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

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

  const myMessageCount = messages.filter((m) => m.sender_id === authUser.id).length;

  const chatPanel = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <header className="z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
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
                  disabled={deleteBusy || myMessageCount === 0}
                  onSelect={(e) => {
                    e.preventDefault();
                    setClearMineOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear my messages
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

      {stripProduct ? (
        <div className="shrink-0 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2.5 sm:px-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
            Product in this chat
          </p>
          <Link
            to={`/products/${stripProduct.id}`}
            className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/90 p-2 shadow-sm transition-colors hover:border-emerald-200 hover:bg-white"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {stripProduct.image ? (
                <img src={stripProduct.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No image</div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="line-clamp-2 text-sm font-semibold text-gray-900">{stripProduct.title}</p>
              <p className="mt-0.5 text-sm font-bold text-[#16a34a]">{formatPrice(stripProduct.price)}</p>
              <span className="mt-0.5 inline-block text-[11px] font-semibold text-[#15803d] hover:underline">
                View listing →
              </span>
            </div>
          </Link>
        </div>
      ) : null}

      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth px-3 py-3 sm:px-4 sm:py-4 [-webkit-overflow-scrolling:touch]"
      >
        <div className="flex flex-col pb-1">
          {messages.map((msg) => {
            const mine = msg.sender_id === authUser.id;
            const t = new Date(msg.created_at);
            const timeLabel = Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            const readByPeer = mine && isOutgoingReadByPeer(conversation, authUser.id, msg.created_at);
            const parent = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : undefined;
            const replyLabel =
              parent == null ? "Message" : parent.sender_id === authUser.id ? "You" : peerFirstName;
            const replyPreview = parent ? parent.message : "Original message unavailable";
            const replyShort =
              replyPreview.length > 100 ? `${replyPreview.slice(0, 100).trimEnd()}…` : replyPreview;
            return (
              <div key={msg.id} className={`group/msg mb-2 flex last:mb-0 ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`relative max-w-[min(85%,22rem)] rounded-2xl p-3 shadow-sm sm:max-w-[75%] ${
                    mine
                      ? "rounded-tr-none border border-green-200/70 bg-green-100 text-gray-900"
                      : "rounded-tl-none border border-gray-200/90 bg-white text-gray-900"
                  }`}
                >
                  {msg.reply_to_id ? (
                    <div className="mb-2 rounded-md bg-gray-200/95 px-2 py-1.5 text-left text-sm text-gray-700">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{replyLabel}</p>
                      <p className="line-clamp-3 text-xs leading-snug">{replyShort}</p>
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{msg.message}</div>
                  <div className={`mt-2 flex items-center gap-1.5 ${mine ? "justify-end" : "justify-between"}`}>
                    {!mine ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="-ml-1 rounded-lg p-1 text-gray-500 opacity-100 hover:bg-gray-100 md:opacity-0 md:transition-opacity md:group-hover/msg:opacity-100"
                            aria-label="Message actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={(e) => {
                              e.preventDefault();
                              setReplyTo(msg);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                            Reply
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                    <div className={`flex items-center gap-1 ${mine ? "" : "ml-auto"}`}>
                      {timeLabel ? (
                        <span className="text-[11px] tabular-nums text-gray-500">{timeLabel}</span>
                      ) : null}
                      {mine ? (
                        <span
                          className={`inline-flex items-center ${readByPeer ? "text-blue-600" : "text-gray-500"}`}
                          title={readByPeer ? "Read" : "Delivered"}
                        >
                          {readByPeer ? <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </span>
                      ) : null}
                    </div>
                    {mine ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="-mr-1 rounded-lg p-1 text-gray-600 opacity-100 hover:bg-green-200/50 md:opacity-0 md:transition-opacity md:group-hover/msg:opacity-100"
                            aria-label="Message actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={(e) => {
                              e.preventDefault();
                              setReplyTo(msg);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                            Reply
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            className="gap-2"
                            onSelect={(e) => {
                              e.preventDefault();
                              setDeleteConfirmMessage(msg);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-30 shrink-0 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="px-3 py-3">
          {peerTyping ? (
            <div className="mb-2 mt-0.5 flex items-center gap-2 text-sm italic text-gray-500">
              <span className="typing-dots flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </span>
              <span>
                {peerFirstName} is typing…
              </span>
            </div>
          ) : null}
          {replyTo ? (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2">
              <Reply className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" aria-hidden />
              <div className="min-w-0 flex-1 border-l-2 border-[#22c55e] pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#15803d]">
                  Replying to {replyTo.sender_id === authUser.id ? "yourself" : peerFirstName}
                </p>
                <p className="line-clamp-2 text-xs text-gray-700">{replyTo.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-200/80"
                aria-label="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-gray-100"
                  aria-label="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={10}
                className="z-[70] w-auto border-gray-200 p-2 shadow-lg"
              >
                <ChatEmojiPickerContent
                  onPick={(em) => {
                    insertEmoji(em);
                    setEmojiPickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Attach"
              disabled
            >
              <Paperclip className="h-5 w-5 opacity-50" />
            </button>
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={composerRef}
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

      <AlertDialog
        open={deleteConfirmMessage != null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleteConfirmMessage(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message for both you and {peerName}. You can&apos;t undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={deleteBusy}
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (deleteConfirmMessage) void executeDeleteMessage(deleteConfirmMessage);
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clearMineOpen}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setClearMineOpen(false);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your messages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {myMessageCount} message{myMessageCount === 1 ? "" : "s"} you sent in this
              conversation. {peerFirstName} will no longer see them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={deleteBusy}
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => void executeClearMyMessages()}
            >
              {deleteBusy ? "Clearing…" : "Clear my messages"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const shellHeight =
    "max-md:h-[calc(100dvh-4rem-0.75rem)] max-md:max-h-[calc(100dvh-4rem-0.75rem)] md:h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

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
        className={`mx-auto grid w-full max-w-[1280px] grid-cols-1 md:grid-cols-[1fr_2fr] lg:grid-cols-[1fr_2fr_1fr] ${shellHeight}`}
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
