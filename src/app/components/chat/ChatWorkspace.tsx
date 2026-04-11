import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  Ban,
  Check,
  Copy,
  Eraser,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Package,
  Phone,
  Reply,
  Search,
  Send,
  Share2,
  Smile,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { formatListTime, useInboxConversationList } from "../../hooks/useInboxConversationList";
import { getAvatarUrl } from "../../utils/getAvatar";
import { getProductPrice } from "../../utils/getProductPrice";
import {
  clearConversationContextProduct,
  fetchConversationById,
  findConversationByPair,
  insertConversationPair,
  otherPartyUserId,
  setConversationContextProduct,
  updateConversationLastRead,
  type ConversationRow,
} from "../../utils/chatConversations";
import {
  CHAT_MESSAGE_BASE_COLUMNS,
  fetchChatMessagesForConversation,
  markConversationMessagesDelivered,
  markConversationMessagesRead,
  normalizeChatMessageRow,
  outgoingReceiptPhase,
  resolveChatMessageReplyPreviews,
  type ChatMessageRow,
} from "../../utils/chatMessages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { MessageBubble } from "./MessageBubble";
import { ChatPortraitProductCard } from "./ChatPortraitProductCard";

const CHAT_MEDIA_BUCKETS = ["chat-media", "chat-images", "chat-attachments"] as const;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VOICE_BYTES = 5 * 1024 * 1024;

const CHAT_EMOJI_GRID: string[] = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😘",
  "😉",
  "😎",
  "🤔",
  "👍",
  "👎",
  "🙏",
  "👏",
  "🔥",
  "❤️",
  "💯",
  "✨",
  "🎉",
  "😢",
  "😭",
  "😡",
  "🤝",
  "💬",
  "📎",
  "✅",
];

const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_CANCEL_PX = 14;

function parseConversationInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isDuplicateConversationError(err: { code?: string; message?: string }): boolean {
  const c = String(err.code ?? "");
  const m = String(err.message ?? "").toLowerCase();
  return c === "23505" || m.includes("duplicate") || m.includes("unique") || m.includes("conversations_pair");
}

function isValidConversationUUID(id: string): boolean {
  const t = id.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

function phoneLinkTargets(raw: string | null): { telHref: string; waHref: string } | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const telHref = trimmed.includes("+") ? `tel:${trimmed.replace(/\s/g, "")}` : `tel:${digits}`;
  let waDigits = digits;
  if (!waDigits.startsWith("234") && waDigits.startsWith("0") && waDigits.length >= 10 && waDigits.length <= 11) {
    waDigits = `234${waDigits.slice(1)}`;
  }
  return { telHref, waHref: `https://wa.me/${waDigits}` };
}

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M19.05 4.94A9.9 9.9 0 0 0 12 2a9.96 9.96 0 0 0-8.61 14.96L2 22l5.2-1.36A10 10 0 1 0 19.05 4.94ZM12 20.15a8.14 8.14 0 0 1-4.15-1.13l-.3-.18-3.09.81.83-3.01-.2-.31A8.13 8.13 0 1 1 12 20.15Zm4.46-6.1c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.77-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.36.51.57.18 1.09.16 1.5.1.46-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayDividerLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function withinMinutes(a: string, b: string, minutes: number): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(tb - ta) <= minutes * 60 * 1000;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function messagePreviewText(message: string, imageUrl?: string | null): string {
  const t = message?.trim() ?? "";
  if (t) return t.length > 160 ? `${t.slice(0, 157)}…` : t;
  if (imageUrl) return "Photo";
  return "";
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

type StripProduct = {
  id: number;
  title: string;
  price: number;
  image: string | null;
  like_count: number;
};

type PendingConfirm =
  | { kind: "delete-message"; message: ChatMessageRow }
  | { kind: "bulk-delete-messages"; messageIds: string[] }
  | { kind: "delete-conversation" }
  | { kind: "clear-chat" }
  | null;

async function uploadChatMedia(path: string, file: File, contentType?: string): Promise<string> {
  let lastErr: Error | null = null;
  for (const bucket of CHAT_MEDIA_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: contentType || file.type || undefined,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
      lastErr = new Error("Could not get public URL");
      continue;
    }
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("bucket") || msg.includes("not found")) {
      lastErr = error;
      continue;
    }
    throw error;
  }
  throw lastErr ?? new Error("No chat storage bucket available.");
}

export default function ChatWorkspace() {
  const { conversationId: threadIdParam, peerUserId: peerRouteParam, legacyThreadId } = useParams<{
    conversationId?: string;
    peerUserId?: string;
    legacyThreadId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const formatPrice = useCurrency();

  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSheetMsg, setMobileSheetMsg] = useState<ChatMessageRow | null>(null);
  const [editTarget, setEditTarget] = useState<ChatMessageRow | null>(null);
  const [editText, setEditText] = useState("");

  const atBottomRef = useRef(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [pendingBelow, setPendingBelow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const attachInputRef = useRef<HTMLInputElement>(null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Member");
  const [peerAvatar, setPeerAvatar] = useState("");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [stripProduct, setStripProduct] = useState<StripProduct | null>(null);
  const [messageProductsById, setMessageProductsById] = useState<Map<number, StripProduct>>(() => new Map());
  const [contextClearBusy, setContextClearBusy] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const sendLockRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceHoldRef = useRef(false);

  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const peerHeaderRef = useRef<HTMLElement | null>(null);
  const [peerHeaderHeight, setPeerHeaderHeight] = useState(72);
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    msgId: string | null;
    startX: number;
    startY: number;
  }>({ timer: null, msgId: null, startX: 0, startY: 0 });

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

  const resolveMessageProductCard = useCallback(
    (msg: ChatMessageRow): { strip: StripProduct; pricePending: boolean } | null => {
      const pid = msg.product_id;
      if (pid == null) return null;
      const fromMap = messageProductsById.get(pid);
      if (fromMap) return { strip: fromMap, pricePending: false };
      if (stripProduct && stripProduct.id === pid) return { strip: stripProduct, pricePending: false };
      return {
        strip: { id: pid, title: "Listing", price: 0, image: null, like_count: 0 },
        pricePending: true,
      };
    },
    [messageProductsById, stripProduct],
  );

  const senderLabel = useCallback(
    (uid: string) => (uid === authUser?.id ? "You" : peerFirstName),
    [authUser?.id, peerFirstName],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    atBottomRef.current = true;
    setShowJumpBottom(false);
    setPendingBelow(0);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = gap < 100;
    atBottomRef.current = near;
    setShowJumpBottom(!near);
    if (near) setPendingBelow(0);
  }, []);

  /** Mobile: peer header is `fixed`; keep layout spacer in sync when search row expands. */
  useLayoutEffect(() => {
    const el = peerHeaderRef.current;
    if (!el) return;
    const measure = () => setPeerHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [searchOpen, peerName, conversation?.id]);

  /** Avoid tying shell height to visualViewport.height — it shrinks with the mobile keyboard and collapses the sticky chat header. */
  useLayoutEffect(() => {
    const lastLayoutInnerRef = { current: window.innerHeight };
    const vv = window.visualViewport;

    const apply = () => {
      const inner = window.innerHeight;
      const visibleH = vv?.height ?? inner;
      const typingInDraft = document.activeElement === draftTextareaRef.current;
      // Do not shrink the chat shell to `visualViewport.height` when the keyboard opens — that collapses the sticky header.
      // iOS: `inner` often stays large while `visibleH` drops. Android: both can drop while typing — only then compare to last stable height.
      const likelyObscured =
        visibleH < inner * 0.88 ||
        (typingInDraft && visibleH < lastLayoutInnerRef.current * 0.82);

      if (likelyObscured) {
        setViewportHeight(lastLayoutInnerRef.current);
        return;
      }

      lastLayoutInnerRef.current = inner;
      setViewportHeight(inner);
    };

    apply();
    vv?.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const resolveConversation = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      let conv: ConversationRow | null = null;
      let peer: string | null = null;

      if (threadIdParam && isValidConversationUUID(threadIdParam)) {
        const { data, error } = await fetchConversationById(supabase, threadIdParam);
        if (error) throw new Error(error.message);
        if (!data) {
          setLoadError("Conversation not found.");
          setConversation(null);
          setPeerId(null);
          setLoading(false);
          return;
        }
        conv = data;
        peer = otherPartyUserId(conv, authUser.id);
        if (!peer) throw new Error("Not a participant");
      } else {
        const peerFromUrl = peerRouteParam?.trim() || legacyThreadId?.trim() || "";
        if (!peerFromUrl || !isValidConversationUUID(peerFromUrl)) {
          setLoadError(
            peerFromUrl
              ? "This user cannot be messaged from this link because the account ID is invalid."
              : "Invalid conversation link.",
          );
          setConversation(null);
          setPeerId(null);
          setLoading(false);
          return;
        }
        if (peerFromUrl === authUser.id) {
          setLoadError("You cannot start a chat with yourself.");
          setConversation(null);
          setPeerId(null);
          setLoading(false);
          return;
        }
        const found = await findConversationByPair(supabase, authUser.id, peerFromUrl);
        if (!found) {
          const { data: inserted, error: insErr } = await insertConversationPair(
            supabase,
            authUser.id,
            peerFromUrl,
            { contextProductId: validProductId ?? undefined },
          );
          if (insErr) {
            if (isDuplicateConversationError(insErr)) {
              const again = await findConversationByPair(supabase, authUser.id, peerFromUrl);
              if (!again) throw new Error(insErr.message);
              conv = again;
            } else throw new Error(insErr.message);
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
      setReplyingTo(null);
      setHighlightedMessageId(null);
      setSelectionMode(false);
      setSelectedIds([]);
      setEmojiPickerOpen(false);
      setMessages(msgs);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Could not open chat";
      setLoadError(
        msg.includes("relation") && msg.includes("does not exist")
          ? "Messaging tables are not set up yet. Run the Supabase migration for conversations and chat_messages."
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
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, price_local, image, like_count")
        .eq("id", pid)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setStripProduct(null);
        return;
      }
      const row = data as Record<string, unknown>;
      const lcRaw = row.like_count;
      const likeCount =
        typeof lcRaw === "number" && Number.isFinite(lcRaw) ? lcRaw : Number(lcRaw) || 0;
      setStripProduct({
        id: Number(row.id),
        title: String(row.title ?? "Listing"),
        price: getProductPrice(row as { price?: unknown; price_local?: unknown }),
        image: typeof row.image === "string" ? row.image : null,
        like_count: likeCount,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.context_product_id]);

  useEffect(() => {
    const ids = new Set<number>();
    for (const m of messages) {
      const p = m.product_id;
      if (p != null) ids.add(p);
    }
    if (ids.size === 0) {
      setMessageProductsById(new Map());
      return;
    }
    const list = [...ids];
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, price_local, image, like_count")
        .in("id", list);
      if (cancelled) return;
      if (error || !data) return;
      const next = new Map<number, StripProduct>();
      for (const row of data as Record<string, unknown>[]) {
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        const lcRaw = row.like_count;
        const likeCount =
          typeof lcRaw === "number" && Number.isFinite(lcRaw) ? lcRaw : Number(lcRaw) || 0;
        next.set(id, {
          id,
          title: String(row.title ?? "Listing"),
          price: getProductPrice(row as { price?: unknown; price_local?: unknown }),
          image: typeof row.image === "string" ? row.image : null,
          like_count: likeCount,
        });
      }
      setMessageProductsById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    if (!conversation?.id || !authUser?.id) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const { error } = await updateConversationLastRead(supabase, conversation, authUser.id);
        if (error) return;
        void supabase.rpc("mark_message_notifications_read", { p_conversation_id: conversation.id });
        const readErr = await markConversationMessagesRead(supabase, conversation.id);
        if (readErr.error) console.warn(readErr.error.message);
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
    if (!conversation?.id || !authUser?.id) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const { error } = await markConversationMessagesDelivered(supabase, conversation.id);
        if (error) console.warn(error.message);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [conversation?.id, authUser?.id, messages.length]);

  useEffect(() => {
    if (!conversation?.id) return;
    const mid = conversation.id;

    const msgChannel = supabase
      .channel(`chat-messages-v2:${mid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${mid}`,
        },
        (payload) => {
          const row = normalizeChatMessageRow(payload.new as Record<string, unknown>);
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return resolveChatMessageReplyPreviews(prev);
            const cleaned =
              authUser?.id && row.sender_id === authUser.id
                ? prev.filter(
                    (m) =>
                      !(String(m.id).startsWith("pending-") && m.sender_id === row.sender_id && m.client_sending),
                  )
                : prev;
            return resolveChatMessageReplyPreviews([...cleaned, row]);
          });
          if (!atBottomRef.current) {
            setPendingBelow((n) => n + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${mid}`,
        },
        (payload) => {
          const row = normalizeChatMessageRow(payload.new as Record<string, unknown>);
          setMessages((prev) =>
            resolveChatMessageReplyPreviews(
              prev.map((m) => (m.id === row.id ? { ...m, ...row, client_sending: false } : m)),
            ),
          );
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
          if (!oldRow?.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        },
      )
      .subscribe();

    const convChannel = supabase
      .channel(`chat-conv-v2:${mid}`)
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
  }, [conversation?.id, authUser?.id]);

  const upsertTyping = useCallback(
    async (isTyping: boolean) => {
      if (!conversation?.id || !authUser?.id) return;
      const { error } = await supabase.from("typing_status").upsert(
        {
          conversation_id: conversation.id,
          user_id: authUser.id,
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      );
      if (error && error.message?.includes("typing_status")) {
        /* table not migrated */
      }
    },
    [conversation?.id, authUser?.id],
  );

  useEffect(() => {
    if (!conversation?.id || !authUser?.id) return;
    const ch = supabase
      .channel(`typing-v2:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as { user_id?: string; is_typing?: boolean } | undefined;
          if (!row?.user_id || row.user_id === authUser.id) return;
          setPeerTyping(!!row.is_typing);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [conversation?.id, authUser?.id]);

  useEffect(() => {
    if (!draft.trim()) {
      void upsertTyping(false);
      return;
    }
    void upsertTyping(true);
    const idle = window.setTimeout(() => void upsertTyping(false), 2800);
    return () => clearTimeout(idle);
  }, [draft, upsertTyping]);

  useEffect(() => {
    if (!authUser?.id) return;
    const beat = () => {
      void supabase.from("user_status").upsert(
        {
          user_id: authUser.id,
          is_online: true,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    };
    beat();
    const iv = window.setInterval(beat, 20000);
    const goOffline = () => {
      void supabase.from("user_status").upsert(
        {
          user_id: authUser!.id,
          is_online: false,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    };
    window.addEventListener("beforeunload", goOffline);
    return () => {
      clearInterval(iv);
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!peerId) return;
    void supabase
      .from("user_status")
      .select("is_online, last_seen")
      .eq("user_id", peerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const seen = data.last_seen ? new Date(data.last_seen).getTime() : 0;
        const fresh = Date.now() - seen < 90000;
        setPeerOnline(!!data.is_online && fresh);
      });

    const ch = supabase
      .channel(`peer-status:${peerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_status",
          filter: `user_id=eq.${peerId}`,
        },
        (payload) => {
          const row = payload.new as { is_online?: boolean; last_seen?: string };
          if (!row) return;
          const seen = row.last_seen ? new Date(row.last_seen).getTime() : 0;
          const fresh = Date.now() - seen < 90000;
          setPeerOnline(!!row.is_online && fresh);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [peerId]);

  useEffect(() => {
    if (!messages.length) return;
    if (atBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [messages, peerTyping, scrollToBottom]);

  const removeProductContext = useCallback(async () => {
    if (!conversation?.id) return;
    setContextClearBusy(true);
    try {
      const { error } = await clearConversationContextProduct(supabase, conversation.id);
      if (error) throw error;
      setConversation((c) => (c ? { ...c, context_product_id: null } : c));
      setStripProduct(null);
      toast.success("Listing removed from chat header");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Could not update"));
    } finally {
      setContextClearBusy(false);
    }
  }, [conversation?.id]);

  const sendMessage = useCallback(
    async (opts?: {
      text?: string;
      imageFile?: File | null;
      voiceBlob?: Blob | null;
      voiceMime?: string;
      productId?: number | null;
    }) => {
      const text = (opts?.text ?? draft).trim();
      const imageFile = opts?.imageFile;
      const voiceBlob = opts?.voiceBlob;
      const productId = opts?.productId ?? null;

      if (!authUser?.id || !conversation) {
        toast.error("Chat is not ready.");
        return;
      }
      if (!text && !imageFile && !voiceBlob && productId == null) {
        toast.message("Type a message or attach media.");
        return;
      }
      if (sendLockRef.current) return;
      sendLockRef.current = true;
      setSendBusy(true);
      const replyToId = replyingTo?.id ?? null;
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let outgoingMessage = text;

      try {
        if (imageFile) {
          if (imageFile.size > MAX_IMAGE_BYTES) {
            toast.error(`Image too large (max ${formatBytes(MAX_IMAGE_BYTES)})`);
            setSendBusy(false);
            return;
          }
          const ext = imageFile.name.split(".").pop() || "jpg";
          const path = `${conversation.id}/${authUser.id}/${crypto.randomUUID()}.${ext}`;
          imageUrl = await uploadChatMedia(path, imageFile, imageFile.type);
          if (!outgoingMessage) outgoingMessage = "";
        }

        if (voiceBlob) {
          if (voiceBlob.size > MAX_VOICE_BYTES) {
            toast.error("Voice note too large.");
            setSendBusy(false);
            return;
          }
          const ext = voiceBlob.type.includes("webm") ? "webm" : "m4a";
          const path = `${conversation.id}/${authUser.id}/voice-${crypto.randomUUID()}.${ext}`;
          const file = new File([voiceBlob], path.split("/").pop() || "voice.webm", {
            type: voiceBlob.type || opts?.voiceMime || "audio/webm",
          });
          mediaUrl = await uploadChatMedia(path, file, file.type);
          if (!outgoingMessage) outgoingMessage = "";
        }

        const tempId = `pending-${crypto.randomUUID()}`;
        const optimistic: ChatMessageRow = {
          id: tempId,
          sender_id: authUser.id,
          message: outgoingMessage,
          created_at: new Date().toISOString(),
          status: "sent",
          delivered_at: null,
          read_at: null,
          reply_to_id: replyToId,
          reply_preview: null,
          image_url: imageUrl,
          media_url: mediaUrl,
          edited: false,
          product_id: productId,
          client_sending: true,
        };
        setMessages((prev) => resolveChatMessageReplyPreviews([...prev, optimistic]));
        setReplyingTo(null);
        setDraft("");
        scrollToBottom("smooth");

        const { data: inserted, error } = await supabase
          .from("chat_messages")
          .insert({
            conversation_id: conversation.id,
            sender_id: authUser.id,
            message: outgoingMessage || "",
            reply_to_id: replyToId,
            image_url: imageUrl,
            media_url: mediaUrl,
            product_id: productId,
          })
          // Plain columns only — embedding `reply_to:...!chat_messages_reply_to_id_fkey` often causes
          // PostgREST 400 (PGRST204) if FK name/cache differs; reply previews are resolved client-side.
          .select(CHAT_MESSAGE_BASE_COLUMNS)
          .single();

        if (error) throw error;
        const row = normalizeChatMessageRow(inserted as Record<string, unknown>);
        setMessages((prev) =>
          resolveChatMessageReplyPreviews(
            prev.map((m) => (m.id === tempId ? { ...row, client_sending: false } : m)),
          ),
        );
      } catch (e: unknown) {
        console.error("[chat_messages insert]", e);
        if (e && typeof e === "object" && "code" in e) {
          const pe = e as { code?: string; message?: string; details?: string; hint?: string };
          console.error("PostgREST:", pe.code, pe.message, pe.details, pe.hint);
        }
        toast.error(errorMessage(e, "Message not sent"));
        setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("pending-")));
      } finally {
        sendLockRef.current = false;
        setSendBusy(false);
      }
    },
    [authUser?.id, conversation, draft, replyingTo, scrollToBottom],
  );

  const sendProductCard = useCallback(() => {
    const pid = conversation?.context_product_id ?? stripProduct?.id ?? null;
    if (pid == null) {
      toast.message("No listing linked to this chat.");
      return;
    }
    void sendMessage({ text: "", productId: pid });
  }, [conversation?.context_product_id, stripProduct?.id, sendMessage]);

  const stopRecordingCleanup = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setRecordMs(0);
    voiceHoldRef.current = false;
  }, []);

  const finishRecording = useCallback(async () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") {
      stopRecordingCleanup();
      return;
    }
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    const mime = rec.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    stopRecordingCleanup();
    if (blob.size < 400) {
      toast.message("Recording too short.");
      return;
    }
    await sendMessage({ voiceBlob: blob, voiceMime: mime });
  }, [sendMessage, stopRecordingCleanup]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.start(120);
      setRecording(true);
      setRecordMs(0);
      const started = Date.now();
      recordTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - started;
        setRecordMs(elapsed);
        if (elapsed > 120000) {
          if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
          }
          void finishRecording();
        }
      }, 500);
    } catch {
      toast.error("Could not access microphone.");
      stopRecordingCleanup();
    }
  }, [stopRecordingCleanup, finishRecording]);

  const onMicPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      voiceHoldRef.current = true;
      void startRecording();
    },
    [startRecording],
  );

  const onMicPointerUp = useCallback(() => {
    if (!voiceHoldRef.current) return;
    voiceHoldRef.current = false;
    void finishRecording();
  }, [finishRecording]);

  useEffect(() => {
    const up = () => onMicPointerUp();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onMicPointerUp]);

  const onPickImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      void sendMessage({ imageFile: file });
    },
    [sendMessage],
  );

  const copyText = useCallback(async (msg: ChatMessageRow) => {
    try {
      await navigator.clipboard.writeText(msg.message || "");
      toast.success("Copied");
      setMobileSheetMsg(null);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleMessageSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const enterSelectionWith = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds([id]);
    setReplyingTo(null);
  }, []);

  const suppressNextRowClickRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    const t = longPressRef.current.timer;
    if (t) clearTimeout(t);
    longPressRef.current = { timer: null, msgId: null, startX: 0, startY: 0 };
  }, []);

  const onMessagePointerDown = useCallback(
    (msgId: string, e: React.PointerEvent) => {
      if (selectionMode) return;
      if (e.button !== 0) return;
      longPressRef.current = {
        timer: window.setTimeout(() => {
          longPressRef.current.timer = null;
          suppressNextRowClickRef.current = true;
          window.setTimeout(() => {
            suppressNextRowClickRef.current = false;
          }, 450);
          enterSelectionWith(msgId);
        }, LONG_PRESS_MS),
        msgId,
        startX: e.clientX,
        startY: e.clientY,
      };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    [selectionMode, enterSelectionWith],
  );

  const onMessagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const lp = longPressRef.current;
      if (!lp.timer || !lp.msgId) return;
      if (
        Math.abs(e.clientX - lp.startX) > LONG_PRESS_MOVE_CANCEL_PX ||
        Math.abs(e.clientY - lp.startY) > LONG_PRESS_MOVE_CANCEL_PX
      ) {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer],
  );

  const onMessagePointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      clearLongPressTimer();
    },
    [clearLongPressTimer],
  );

  const onMessageRowClick = useCallback(
    (msg: ChatMessageRow) => {
      if (suppressNextRowClickRef.current) {
        suppressNextRowClickRef.current = false;
        return;
      }
      if (selectionMode) {
        toggleMessageSelected(msg.id);
        return;
      }
      setReplyingTo(msg);
      setHighlightedMessageId(msg.id);
      window.setTimeout(() => setHighlightedMessageId(null), 800);
    },
    [selectionMode, toggleMessageSelected],
  );

  const insertEmoji = useCallback((emoji: string) => {
    setEmojiPickerOpen(false);
    const el = draftTextareaRef.current;
    setDraft((d) => {
      const start = el?.selectionStart ?? d.length;
      const end = el?.selectionEnd ?? d.length;
      const next = d.slice(0, start) + emoji + d.slice(end);
      const pos = start + emoji.length;
      requestAnimationFrame(() => {
        const ta = draftTextareaRef.current;
        if (!ta) return;
        ta.focus();
        try {
          ta.setSelectionRange(pos, pos);
        } catch {
          /* noop */
        }
      });
      return next;
    });
  }, []);

  const selectedMessagesTextBlock = useMemo(() => {
    const texts = messages
      .filter((m) => selectedIds.includes(m.id))
      .map((m) => m.message?.trim() ?? "")
      .filter(Boolean);
    return texts.join("\n\n");
  }, [messages, selectedIds]);

  const bulkCopySelected = useCallback(async () => {
    if (!selectedMessagesTextBlock) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedMessagesTextBlock);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }, [selectedMessagesTextBlock]);

  const bulkForwardSelected = useCallback(async () => {
    if (!selectedMessagesTextBlock) {
      toast.message("Nothing to forward");
      return;
    }
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: selectedMessagesTextBlock });
      } else {
        await navigator.clipboard.writeText(selectedMessagesTextBlock);
        toast.success("Copied for forwarding");
      }
    } catch {
      /* user cancelled share or share failed */
    }
  }, [selectedMessagesTextBlock]);

  const bulkDeleteSelected = useCallback(() => {
    if (!authUser?.id) return;
    const ownDeletable = messages.filter(
      (m) =>
        selectedIds.includes(m.id) &&
        m.sender_id === authUser.id &&
        !String(m.id).startsWith("pending-"),
    );
    if (!ownDeletable.length) {
      toast.message("No messages you can delete in this selection.");
      return;
    }
    setPendingConfirm({ kind: "bulk-delete-messages", messageIds: ownDeletable.map((m) => m.id) });
  }, [authUser?.id, messages, selectedIds]);

  const deleteMessage = useCallback((msg: ChatMessageRow) => {
    setMobileSheetMsg(null);
    setPendingConfirm({ kind: "delete-message", message: msg });
  }, []);

  const runConfirm = useCallback(async () => {
    if (!pendingConfirm || actionBusy) return;
    setActionBusy(true);
    try {
      if (pendingConfirm.kind === "delete-message") {
        const target = pendingConfirm.message;
        const { error } = await supabase.from("chat_messages").delete().eq("id", target.id);
        if (error) throw error;
        setMessages((prev) => prev.filter((m) => m.id !== target.id));
        setReplyingTo((c) => (c?.id === target.id ? null : c));
        toast.success("Message deleted");
      } else if (pendingConfirm.kind === "bulk-delete-messages") {
        const ids = pendingConfirm.messageIds;
        for (const id of ids) {
          const { error } = await supabase.from("chat_messages").delete().eq("id", id);
          if (error) throw error;
        }
        const idSet = new Set(ids);
        setMessages((prev) => prev.filter((m) => !idSet.has(m.id)));
        setReplyingTo((c) => (c && idSet.has(c.id) ? null : c));
        setSelectedIds([]);
        setSelectionMode(false);
        toast.success(ids.length === 1 ? "Message deleted" : `${ids.length} messages deleted`);
      } else if (pendingConfirm.kind === "delete-conversation") {
        const cid = conversation?.id;
        if (!cid) {
          toast.error("Conversation not ready.");
          return;
        }
        const { error } = await supabase.from("conversations").delete().eq("id", cid);
        if (error) throw error;
        toast.success("Conversation deleted");
        navigate("/messages", { replace: true });
        return;
      } else if (pendingConfirm.kind === "clear-chat") {
        const cid = conversation?.id;
        if (!cid) {
          toast.error("Conversation not ready.");
          return;
        }
        const { error } = await supabase.from("chat_messages").delete().eq("conversation_id", cid);
        if (error) throw error;
        setMessages([]);
        setReplyingTo(null);
        toast.success("Chat cleared");
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Action failed"));
    } finally {
      setActionBusy(false);
      setPendingConfirm(null);
    }
  }, [actionBusy, conversation?.id, navigate, pendingConfirm]);

  const saveEdit = useCallback(async () => {
    if (!editTarget || !authUser?.id) return;
    const t = editText.trim();
    if (!t) {
      toast.error("Message cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("chat_messages")
      .update({ message: t, edited: true })
      .eq("id", editTarget.id)
      .eq("sender_id", authUser.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === editTarget.id ? { ...m, message: t, edited: true } : m)),
    );
    setEditTarget(null);
    toast.success("Message updated");
  }, [editTarget, editText, authUser?.id]);

  const jumpToMessage = useCallback((id: string | null | undefined) => {
    if (!id) return;
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(id);
      window.setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  const peerContactLinks = phoneLinkTargets(peerPhone);
  const chatShellStyle = {
    ...(viewportHeight ? { ["--chat-viewport-height" as string]: `${viewportHeight}px` } : {}),
    ["--chat-header-height" as string]: "72px",
  } as React.CSSProperties;

  const filteredThreadSearch = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.message || "").toLowerCase().includes(q));
  }, [messages, threadSearch]);

  const openExternalChannel = useCallback(
    (kind: "whatsapp" | "voice") => {
      if (!peerContactLinks) return;
      const url = kind === "whatsapp" ? peerContactLinks.waHref : peerContactLinks.telHref;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [peerContactLinks],
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-medium text-gray-800 dark:text-foreground">Please sign in to view this chat.</p>
        <Button type="button" onClick={() => navigate("/login")}>
          Go to login
        </Button>
      </div>
    );
  }

  if (!conversation || !peerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-medium text-gray-800 dark:text-foreground">Chat could not be loaded.</p>
        {loadError ? <p className="max-w-md text-sm text-muted-foreground">{loadError}</p> : null}
        <Button variant="outline" asChild>
          <Link to="/messages">Back to messages</Link>
        </Button>
      </div>
    );
  }

  const shellHeight =
    "max-md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] max-md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)]";

  const conversationList = (
    <>
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/90">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-foreground">Messages</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={inboxSearch}
            onChange={(e) => setInboxSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg bg-gray-100 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] dark:bg-zinc-800 dark:text-foreground"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-zinc-900/50">
        {inboxLoadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-600">{inboxLoadError}</div>
        ) : inboxLoading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-600">Loading conversations…</div>
        ) : inboxFiltered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
              <MessageCircle className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No messages yet</h3>
            <p className="mb-6 text-sm text-gray-600">Start chatting with sellers about listings.</p>
            <Link to="/products" className="inline-block rounded-lg bg-[#22c55e] px-6 py-3 font-medium text-white">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {inboxFiltered.map((row) => {
              const oid = inboxOtherPartyUserId(row);
              if (!oid) return null;
              const p = inboxProfiles.get(oid);
              const name = p?.full_name?.trim() || "Member";
              const avatar = getAvatarUrl(p?.avatar_url ?? null, p?.gender ?? null, name);
              const aboutProduct =
                row.context_product_id != null ? inboxProductTitles.get(row.context_product_id) : undefined;
              const active = conversation?.id === row.id;
              return (
                <Link
                  key={row.id}
                  to={`/messages/c/${row.id}`}
                  className={`flex items-center gap-3 border-b border-gray-50 p-3 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800/80 sm:p-4 ${
                    active ? "bg-emerald-50/80 dark:bg-emerald-950/40" : ""
                  }`}
                >
                  <img src={avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 dark:text-foreground">{name}</h3>
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
                      className={`line-clamp-2 text-sm ${row.last_message ? "text-gray-700 dark:text-zinc-300" : "italic text-gray-400"}`}
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

  const chatPanel = (
    <>
      <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-[#eefbf4] to-cyan-50 dark:from-zinc-950 dark:via-emerald-950/40 dark:to-slate-950">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(16,185,129,0.15),transparent_45%)] dark:bg-[radial-gradient(ellipse_at_30%_0%,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_70%_90%,rgba(16,185,129,0.12),transparent_40%)]" />
          <div className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10" />
        </div>

        {/* Mobile: fixed below TopNav so it stays visible while typing / scrolling; md+: sticky in column. */}
        <header
          ref={peerHeaderRef}
          className={cn(
            "shrink-0 border-b border-emerald-200/90 bg-white shadow-md dark:border-emerald-800/80 dark:bg-zinc-900",
            "max-md:fixed max-md:left-0 max-md:right-0 max-md:top-16 max-md:z-40",
            "md:sticky md:top-16 md:z-30",
          )}
        >
          <div className="px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate("/messages")}
                className="-ml-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 md:hidden"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </button>
              <div className="relative shrink-0">
                <img
                  src={peerAvatar || getAvatarUrl(null, null, peerName)}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/80 dark:ring-zinc-700"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-semibold leading-tight text-gray-900 dark:text-zinc-100">{peerName}</h1>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      peerTyping || peerOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"
                    }`}
                    title={peerTyping ? "Typing" : peerOnline ? "Online" : "Offline"}
                    aria-hidden
                  />
                  <p className="truncate text-xs text-gray-500 dark:text-muted-foreground">
                    {peerTyping ? `${peerFirstName} is typing…` : peerOnline ? "Active now" : "Offline"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Search in chat"
              >
                <Search className="h-5 w-5" />
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 ${peerContactLinks ? "" : "opacity-60"}`}
                    aria-label="Contact"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>{peerName}</DropdownMenuLabel>
                  {peerContactLinks ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          openExternalChannel("whatsapp");
                        }}
                      >
                        <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                        WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          openExternalChannel("voice");
                        }}
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled className="text-xs">
                        No phone on profile
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800" aria-label="More">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Chat</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setPendingConfirm({ kind: "delete-conversation" });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete conversation
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      navigate("/settings/blocked-users");
                      toast.message("Finish blocking from Settings.");
                    }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Block user
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setPendingConfirm({ kind: "clear-chat" });
                    }}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear chat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/profile/${peerId}`} className="flex cursor-pointer items-center gap-2">
                      <User className="h-4 w-4" />
                      View profile
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {searchOpen ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 dark:border-emerald-900 dark:bg-zinc-800/90">
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search in conversation…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-foreground"
                />
                <span className="text-xs text-gray-500">
                  {threadSearch.trim() ? `${filteredThreadSearch.length} match` : ""}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-emerald-600"
                  onClick={() => {
                    const q = threadSearch.trim().toLowerCase();
                    if (!q) return;
                    const hit = messages.find((m) => (m.message || "").toLowerCase().includes(q));
                    if (hit) jumpToMessage(hit.id);
                    else toast.message("No matches");
                  }}
                >
                  Jump
                </button>
              </div>
            ) : null}
          </div>
        </header>
        {/* Reserves space for fixed header on small screens (header is out of flow when fixed). */}
        <div className="max-md:shrink-0 md:hidden" style={{ height: peerHeaderHeight }} aria-hidden />

        {stripProduct ? (
          <div className="relative z-20 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white/95 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/90 sm:px-4">
            <Link
              to={`/products/${stripProduct.id}`}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5 dark:bg-zinc-800"
            >
              {stripProduct.image ? (
                <img src={stripProduct.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No image</div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to={`/products/${stripProduct.id}`}
                className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-emerald-700 dark:text-foreground"
              >
                {stripProduct.title}
              </Link>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatPrice(stripProduct.price)}</p>
            </div>
            <button
              type="button"
              onClick={() => void removeProductContext()}
              disabled={contextClearBusy}
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800"
              aria-label="Remove listing from chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {showJumpBottom ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-800 dark:bg-zinc-900/95 dark:text-emerald-300"
              >
                <ArrowDown className="h-4 w-4" />
                {pendingBelow > 0 ? `${pendingBelow} new` : "Scroll to bottom"}
              </button>
            </div>
          ) : null}

          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="chat-messages min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 [-webkit-overflow-scrolling:touch]"
          >
            <div className="flex flex-col pb-1">
              {messages.map((msg, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const next = i < messages.length - 1 ? messages[i + 1] : null;
                const showDayDivider = !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
                const sameCluster =
                  !!prev && prev.sender_id === msg.sender_id && withinMinutes(prev.created_at, msg.created_at, 8);
                const sameNextCluster =
                  !!next && next.sender_id === msg.sender_id && withinMinutes(msg.created_at, next.created_at, 8);
                const showMeta = !sameNextCluster;
                const mine = msg.sender_id === authUser.id;
                const t = new Date(msg.created_at);
                const timeLabel = Number.isNaN(t.getTime())
                  ? ""
                  : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const replyPreview = msg.reply_preview;
                const quotedSender = replyPreview ? senderLabel(replyPreview.sender_id) : "Message";
                const isHighlighted = highlightedMessageId === msg.id;
                const productCard = resolveMessageProductCard(msg);

                const rowBody = (
                  <div
                    className="touch-manipulation min-w-0 flex-1"
                    onPointerDown={(e) => onMessagePointerDown(msg.id, e)}
                    onPointerMove={onMessagePointerMove}
                    onPointerUp={onMessagePointerUp}
                    onPointerCancel={onMessagePointerUp}
                    onClick={() => onMessageRowClick(msg)}
                  >
                    <MessageBubble
                      mine={mine}
                      senderName={mine ? "You" : peerFirstName}
                      showSenderName={!sameCluster}
                      timeLabel={timeLabel}
                      showMeta={showMeta}
                      receiptPhase={outgoingReceiptPhase(msg)}
                      showIncomingRead={!mine && !!msg.read_at}
                      isHighlighted={isHighlighted}
                      edited={!!msg.edited}
                      replySlot={
                        replyPreview || msg.reply_to_id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectionMode) {
                                toggleMessageSelected(msg.id);
                                return;
                              }
                              jumpToMessage(replyPreview?.id ?? msg.reply_to_id);
                            }}
                            className={`mb-2 block w-full rounded-xl border-l-4 px-3 py-2 text-left transition ${
                              mine
                                ? "border-white/60 bg-white/18 text-white/95 hover:bg-white/22"
                                : "border-emerald-500/80 bg-white/40 text-gray-900 hover:bg-white/55"
                            }`}
                          >
                            <p className="truncate text-[11px] font-semibold">{quotedSender}</p>
                            <p className="line-clamp-2 text-[12px] leading-snug opacity-90">
                              {replyPreview
                                ? messagePreviewText(replyPreview.message, replyPreview.image_url)
                                : "Original message"}
                            </p>
                          </button>
                        ) : null
                      }
                      belowBubbleSlot={
                        productCard ? (
                          <ChatPortraitProductCard
                            productId={productCard.strip.id}
                            title={productCard.strip.title}
                            priceLabel={productCard.pricePending ? "…" : formatPrice(productCard.strip.price)}
                            imageUrl={productCard.strip.image}
                            disableLink={selectionMode}
                          />
                        ) : null
                      }
                    >
                      <div className="space-y-2">
                        {msg.image_url ? (
                          <img
                            src={msg.image_url}
                            alt=""
                            className="max-h-64 max-w-full rounded-lg object-cover"
                            loading="lazy"
                            onClick={(e) => !selectionMode && e.stopPropagation()}
                          />
                        ) : null}
                        {msg.media_url ? (
                          <audio
                            src={msg.media_url}
                            controls
                            className="max-w-[min(100%,280px)]"
                            preload="metadata"
                            onClick={(e) => !selectionMode && e.stopPropagation()}
                          />
                        ) : null}
                        {msg.message?.trim() ? (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.message}</p>
                        ) : null}
                        {msg.client_sending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
                            <Loader2 className="h-3 w-3 animate-spin" /> Sending…
                          </span>
                        ) : null}
                      </div>
                    </MessageBubble>
                  </div>
                );

                return (
                  <Fragment key={msg.id}>
                    {showDayDivider ? (
                      <div className="mb-3 flex justify-center">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-white/10">
                          {dayDividerLabel(msg.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      ref={(node) => {
                        if (node) messageRefs.current.set(msg.id, node);
                        else messageRefs.current.delete(msg.id);
                      }}
                      className={cn(
                        "flex w-full items-start gap-1 sm:gap-2",
                        sameCluster ? "mb-0.5" : "mb-2",
                      )}
                    >
                      {selectionMode ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selectedIds.includes(msg.id)}
                          aria-label={selectedIds.includes(msg.id) ? "Deselect message" : "Select message"}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMessageSelected(msg.id);
                          }}
                          className={cn(
                            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.97]",
                            selectedIds.includes(msg.id)
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm dark:border-emerald-400"
                              : "border-gray-300 bg-white/90 text-gray-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
                          )}
                        >
                          {selectedIds.includes(msg.id) ? <Check className="h-5 w-5" strokeWidth={2.5} /> : null}
                        </button>
                      ) : null}
                      {selectionMode ? (
                        rowBody
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>{rowBody}</ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() => {
                                setReplyingTo(msg);
                                jumpToMessage(msg.id);
                              }}
                            >
                              <Reply className="mr-2 h-4 w-4" />
                              Reply
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void copyText(msg)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy
                            </ContextMenuItem>
                            {mine ? (
                              <ContextMenuItem
                                onSelect={() => {
                                  setEditTarget(msg);
                                  setEditText(msg.message || "");
                                }}
                              >
                                Edit
                              </ContextMenuItem>
                            ) : null}
                            {mine ? (
                              <ContextMenuItem
                                className="text-red-600"
                                onSelect={() => setPendingConfirm({ kind: "delete-message", message: msg })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </ContextMenuItem>
                            ) : null}
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => setMobileSheetMsg(msg)} className="md:hidden">
                              More…
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}
                    </div>
                  </Fragment>
                );
              })}
              {peerTyping ? (
                <div className="mb-2 flex items-center gap-2 text-sm italic text-gray-600 dark:text-zinc-400">
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </span>
                  <span>{peerFirstName} is typing…</span>
                </div>
              ) : null}
              <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
            </div>
          </div>

          {recording ? (
            <div className="relative z-30 flex items-center justify-center gap-3 border-t border-red-200 bg-red-50/95 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/80 dark:text-red-200">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording… {Math.round(recordMs / 1000)}s (release to send)
            </div>
          ) : null}

          <div className="relative z-30 shrink-0 border-t border-emerald-100/90 bg-white/96 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur dark:border-emerald-900/60 dark:bg-zinc-900/96 dark:shadow-[0_-2px_12px_rgba(0,0,0,0.35)]">
            {selectionMode ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100/80 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/40">
                <span className="min-h-[44px] flex-1 content-center text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {selectedIds.length} selected
                </span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] touch-manipulation px-3"
                    onClick={() => void bulkCopySelected()}
                  >
                    <Copy className="mr-1.5 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] touch-manipulation px-3"
                    onClick={() => void bulkForwardSelected()}
                  >
                    <Share2 className="mr-1.5 h-4 w-4" />
                    Forward
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] touch-manipulation px-3"
                    onClick={bulkDeleteSelected}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] touch-manipulation px-3"
                    onClick={exitSelectionMode}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="px-3 py-3 sm:px-4">
              {replyingTo ? (
                <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/50">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Replying to {senderLabel(replyingTo.sender_id)}
                    </p>
                    <p className="truncate text-sm text-emerald-950/80 dark:text-emerald-100/80">
                      {messagePreviewText(replyingTo.message, replyingTo.image_url)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 rounded-full p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div
                className={cn(
                  "flex flex-wrap items-end gap-2",
                  selectionMode && "pointer-events-none select-none opacity-45",
                )}
              >
                <input ref={attachInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label="Attach image"
                >
                  <ImagePlus className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendProductCard()}
                  disabled={!conversation.context_product_id && !stripProduct}
                  className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label="Share listing"
                  title="Share product card"
                >
                  <Package className="h-6 w-6" />
                </button>
                <div className="relative min-h-[44px] min-w-0 flex-1">
                  <textarea
                    ref={draftTextareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Message…"
                    className="min-h-[44px] w-full resize-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-3 pr-12 text-sm outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
                  />
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-1.5 right-1.5 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 active:scale-95 dark:text-emerald-400 dark:hover:bg-zinc-700/80"
                        aria-label="Insert emoji"
                        title="Emoji"
                      >
                        <Smile className="h-6 w-6" strokeWidth={2} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="end"
                      sideOffset={8}
                      className="w-[min(100vw-2rem,20rem)] touch-manipulation p-2"
                    >
                      <div className="grid max-h-[min(50vh,16rem)] grid-cols-6 gap-1 overflow-y-auto overscroll-contain sm:grid-cols-8">
                        {CHAT_EMOJI_GRID.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-xl transition hover:bg-emerald-50 active:scale-95 dark:hover:bg-zinc-800"
                            onClick={() => insertEmoji(emoji)}
                            aria-label={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <button
                  type="button"
                  onPointerDown={onMicPointerDown}
                  className={`shrink-0 rounded-full p-2 ${recording ? "bg-red-500 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
                  aria-label="Hold to record voice"
                  title="Hold to record"
                >
                  <Mic className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={sendBusy || !draft.trim()}
                  className="shrink-0 rounded-full bg-[#22c55e] p-2.5 text-white shadow-sm dark:bg-emerald-600 disabled:opacity-50"
                  aria-label="Send"
                >
                  {sendBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={mobileSheetMsg != null} onOpenChange={(open) => !open && setMobileSheetMsg(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-4 pb-2">
            <SheetTitle>Message</SheetTitle>
            <SheetDescription>Reply, copy, edit, or delete.</SheetDescription>
          </SheetHeader>
          {mobileSheetMsg ? (
            <div className="grid gap-2 px-4">
              <Button
                className="w-full"
                onClick={() => {
                  setReplyingTo(mobileSheetMsg);
                  setMobileSheetMsg(null);
                }}
              >
                <Reply className="mr-2 h-4 w-4" />
                Reply
              </Button>
              <Button variant="outline" className="w-full" onClick={() => void copyText(mobileSheetMsg)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              {mobileSheetMsg.sender_id === authUser.id ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEditTarget(mobileSheetMsg);
                      setEditText(mobileSheetMsg.message || "");
                      setMobileSheetMsg(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      deleteMessage(mobileSheetMsg);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingConfirm != null} onOpenChange={(open) => !open && setPendingConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.kind === "delete-message"
                ? "Delete message?"
                : pendingConfirm?.kind === "bulk-delete-messages"
                  ? `Delete ${pendingConfirm.messageIds.length} message${pendingConfirm.messageIds.length === 1 ? "" : "s"}?`
                  : pendingConfirm?.kind === "delete-conversation"
                    ? "Delete conversation?"
                    : "Clear chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.kind === "delete-message"
                ? "This removes the message for everyone in the thread."
                : pendingConfirm?.kind === "bulk-delete-messages"
                  ? "This removes the selected messages you sent for everyone in the thread."
                  : pendingConfirm?.kind === "delete-conversation"
                    ? "This deletes the conversation and returns you to the inbox."
                    : "This removes all messages in this chat."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void runConfirm();
              }}
            >
              {actionBusy ? "…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editTarget != null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
          </DialogHeader>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div
      className="h-[calc(var(--chat-viewport-height,100dvh)-4rem)] overflow-hidden bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_22%,#ecfeff_100%)] dark:bg-[linear-gradient(180deg,#0c120f_0%,#0f172a_40%,#0c120f_100%)]"
      style={chatShellStyle}
    >
      <div className={`mx-auto grid w-full max-w-[1100px] grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] ${shellHeight}`}>
        <aside className={`hidden min-h-0 flex-col border-r border-emerald-100 dark:border-emerald-900/50 md:flex ${shellHeight}`}>
          {conversationList}
        </aside>
        <section className={`flex min-h-0 min-w-0 flex-col ${shellHeight}`}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{chatPanel}</div>
        </section>
      </div>
    </div>
  );
}
