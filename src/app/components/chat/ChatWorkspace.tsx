import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  Ban,
  ChevronDown,
  Copy,
  Eraser,
  Flag,
  Loader2,
  Pencil,
  MessageCircle,
  Package,
  Pin,
  Reply,
  Search,
  Share2,
  Star,
  Trash2,
  User,
  UserCheck,
  UserPlus,
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
  fetchConversationById,
  findConversationByPair,
  insertConversationPair,
  otherPartyUserId,
  setConversationContextProduct,
  updateConversationLastRead,
  type ConversationRow,
} from "../../utils/chatConversations";
import {
  clearConversationForMe,
  clearConversationMessages,
  fetchPinnedMessage,
  fetchSavedMessageIds,
  toggleSavedMessage,
  unpinConversation,
  upsertPinnedMessage,
  type PinnedMessageRow,
} from "../../utils/chatMessageExtras";
import {
  isBrowserOnline,
  outboxDelete,
  outboxListConversation,
  outboxPut,
  outboxRecordToChatRow,
  shouldQueueSendFailure,
} from "../../utils/chatOutboxDb";
import {
  CHAT_MESSAGE_BASE_COLUMNS,
  CHAT_MESSAGE_DELETED_PLACEHOLDER,
  canDeleteMessageForEveryone,
  canEditMessage,
  fetchChatMessagesForConversation,
  fetchMessageReactions,
  isDeletedForEveryone,
  isMessageHiddenForViewer,
  markConversationMessagesDelivered,
  markConversationMessagesRead,
  normalizeChatMessageRow,
  outgoingReceiptPhase,
  removeOwnMessageReaction,
  resolveChatMessageReplyPreviews,
  setMessageReaction,
  type ChatMessageRow,
  type MessageReactionsState,
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
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { ChatInputBar } from "./ChatInputBar";
import { ChatPortraitProductCard } from "./ChatPortraitProductCard";
import { ComposerAttachedListing } from "./ComposerAttachedListing";
import { ReportUserDialog } from "./ReportUserDialog";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { MessageBubble } from "./MessageBubble";
import { MessageMenuV2, MESSAGE_QUICK_REACTIONS } from "./MessageMenuV2";
import { ChatPeerHeaderModern } from "./ChatPeerHeaderModern";
import { fetchProfileFollowerCount } from "../../utils/profileFollowCounts";

const CHAT_MEDIA_BUCKETS = ["chat-media", "chat-images", "chat-attachments"] as const;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/** Compare sender to viewer; Postgres UUID strings may not match `===` casing with `auth.user.id`. */
function isMessageFromViewer(senderId: string | undefined, viewerId: string | undefined): boolean {
  if (!senderId || !viewerId) return false;
  return String(senderId).toLowerCase() === String(viewerId).toLowerCase();
}

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

function parseConversationInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parse `?product=` (same numeric id as `products.id` / `conversations.context_product_id`). */
function parseProductQueryParam(param: string | null): number | null {
  if (param == null || param === "") return null;
  const t = decodeURIComponent(String(param)).trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return null;
  const i = Math.trunc(n);
  return i >= 1 ? i : null;
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

function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const PEER_ACTIVE_MS = 5 * 60 * 1000;

function isLastActiveWithin(iso: string | null, ms: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ms;
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
  condition: string | null;
};

type PendingConfirm =
  | { kind: "delete-conversation" }
  | { kind: "clear-chat" }
  | { kind: "clear-chat-both" }
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const formatPrice = useCurrency();

  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSheetMsg, setMobileSheetMsg] = useState<ChatMessageRow | null>(null);
  const [menuSelectedText, setMenuSelectedText] = useState("");
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(() => new Set());
  const [pinnedRow, setPinnedRow] = useState<PinnedMessageRow | null>(null);
  const [infoMsg, setInfoMsg] = useState<ChatMessageRow | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editTarget, setEditTarget] = useState<ChatMessageRow | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<ChatMessageRow | null>(null);

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
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [peerGender, setPeerGender] = useState<string | null>(null);
  const [peerVerified, setPeerVerified] = useState(false);
  const [peerMemberSince, setPeerMemberSince] = useState<string | null>(null);
  const [peerLastActive, setPeerLastActive] = useState<string | null>(null);
  const [peerPresenceTick, setPeerPresenceTick] = useState(0);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [stripProduct, setStripProduct] = useState<StripProduct | null>(null);
  /** True while fetching listing row for the header strip (`context_product_id` / `?product=`). */
  const [listingStripLoading, setListingStripLoading] = useState(false);
  /** Mobile only: when true, listing strip is minimized to one row (tap to expand). */
  const [mobileProductStripCollapsed, setMobileProductStripCollapsed] = useState(false);
  const [messageProductsById, setMessageProductsById] = useState<Map<number, StripProduct>>(() => new Map());
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
  /** Radix ContextMenu steals touch long-press on phones; only wrap on md+ so MessageBubble long-press works on mobile. */
  const [useDesktopContextMenu, setUseDesktopContextMenu] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isFollowingPeer, setIsFollowingPeer] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [peerFollowerCount, setPeerFollowerCount] = useState<number | null>(null);
  /** Hide listing strip locally (X); resets when listing changes */
  const [productStripDismissed, setProductStripDismissed] = useState(false);
  const [reactionByMessage, setReactionByMessage] = useState<Record<string, MessageReactionsState>>({});
  const threadMessagesRef = useRef<ChatMessageRow[]>([]);
  const refreshReactionsRef = useRef<() => Promise<void>>(async () => {});
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const peerHeaderRef = useRef<HTMLElement | null>(null);
  /** After opening chat from a listing (`?product=`), attach `product_id` to the first outbound message. */
  const attachListingToFirstSendRef = useRef(false);
  /** Default taller than the old single-row header so mobile spacer does not overlap extra rows before measure. */
  const [peerHeaderHeight, setPeerHeaderHeight] = useState(168);
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
  const validProductId = useMemo(() => parseProductQueryParam(productParam), [productParam]);

  /** Captures `?product=` so listing attachment survives URL cleanup and `/messages/u` → `/messages/c` redirects. */
  const [productIdFromQuery, setProductIdFromQuery] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    return parseProductQueryParam(new URLSearchParams(window.location.search).get("product"));
  });

  const routePeerOrThreadKey = `${threadIdParam ?? ""}|${peerRouteParam ?? ""}|${legacyThreadId ?? ""}`;
  const prevRouteKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const pid = parseProductQueryParam(searchParams.get("product"));
    const routeChanged = prevRouteKeyRef.current !== routePeerOrThreadKey;
    prevRouteKeyRef.current = routePeerOrThreadKey;

    if (pid != null) {
      setProductIdFromQuery(pid);
      const raw = searchParams.get("product");
      if (raw != null && raw !== "") {
        const next = new URLSearchParams(searchParams);
        next.delete("product");
        const qs = next.toString();
        navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, { replace: true });
      }
    } else if (routeChanged) {
      setProductIdFromQuery(null);
    }
  }, [searchParams, navigate, location.pathname, routePeerOrThreadKey]);

  /** Prefer persisted link intent, then current `?product=`, then conversation row. */
  const stripProductSourceId = useMemo(() => {
    if (productIdFromQuery != null && productIdFromQuery > 0) return productIdFromQuery;
    if (validProductId != null && validProductId > 0) return validProductId;
    const c = conversation ? parseConversationInt(conversation.context_product_id) : null;
    return c != null && c > 0 ? Math.trunc(c) : null;
  }, [productIdFromQuery, validProductId, conversation?.context_product_id]);

  const peerFirstName = useMemo(() => peerName.split(/\s+/)[0] || "Member", [peerName]);

  const peerAvatarDisplay = useMemo(
    () => getAvatarUrl(peerAvatarUrl, peerGender, peerName),
    [peerAvatarUrl, peerGender, peerName],
  );

  const peerActiveByProfile = useMemo(
    () => isLastActiveWithin(peerLastActive, PEER_ACTIVE_MS),
    [peerLastActive, peerPresenceTick],
  );

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
    (uid: string) => (isMessageFromViewer(uid, authUser?.id) ? "You" : peerFirstName),
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

  useEffect(() => {
    threadMessagesRef.current = messages;
  }, [messages]);

  const refreshReactions = useCallback(async () => {
    if (!conversation?.id || !authUser?.id) return;
    const ids = threadMessagesRef.current.map((m) => m.id).filter((id) => !String(id).startsWith("pending-"));
    if (ids.length === 0) {
      setReactionByMessage({});
      return;
    }
    const { byMessage, error } = await fetchMessageReactions(supabase, conversation.id, ids, authUser.id);
    if (error) return;
    setReactionByMessage(byMessage);
  }, [conversation?.id, authUser?.id]);

  useEffect(() => {
    refreshReactionsRef.current = refreshReactions;
  }, [refreshReactions]);

  const messageIdsKey = useMemo(() => messages.map((m) => m.id).join(","), [messages]);

  useEffect(() => {
    void refreshReactions();
  }, [messageIdsKey, refreshReactions]);

  useEffect(() => {
    if (!authUser?.id) {
      setSavedMessageIds(new Set());
      return;
    }
    const ids = messages.map((m) => m.id).filter((id) => !String(id).startsWith("pending-"));
    if (ids.length === 0) {
      setSavedMessageIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchSavedMessageIds(supabase, authUser.id, ids).then(({ ids: s, error }) => {
      if (cancelled || error) return;
      setSavedMessageIds(s);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, messageIdsKey]);

  useEffect(() => {
    if (!conversation?.id) {
      setPinnedRow(null);
      return;
    }
    const cid = conversation.id;
    const load = () => {
      void fetchPinnedMessage(supabase, cid).then(({ data, error }) => {
        if (!error) setPinnedRow(data);
      });
    };
    load();
    const ch = supabase
      .channel(`pinned-msg-ws:${cid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pinned_messages",
          filter: `conversation_id=eq.${cid}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [conversation?.id]);

  useEffect(() => {
    const onSel = () => {
      setMenuSelectedText((document.getSelection()?.toString() ?? "").trim());
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setUseDesktopContextMenu(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Mobile: peer header is `fixed`; spacer must match real height or message list covers rows 2–4. */
  useLayoutEffect(() => {
    const el = peerHeaderRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect().height;
      const block = el.offsetHeight;
      const h = Math.max(Math.ceil(rect), block, 1);
      setPeerHeaderHeight((prev) => (prev === h ? prev : h));
    };
    measure();
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      measure();
      requestAnimationFrame(() => {
        if (cancelled) return;
        measure();
      });
    });
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    searchOpen,
    peerName,
    conversation?.id,
    peerVerified,
    peerAvatarUrl,
    peerGender,
    peerMemberSince,
    peerLastActive,
    peerTyping,
    peerPresenceTick,
    stripProduct,
    stripProductSourceId,
    listingStripLoading,
    productStripDismissed,
    mobileProductStripCollapsed,
    isFollowingPeer,
    peerFollowerCount,
  ]);

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
    attachListingToFirstSendRef.current = false;
    try {
      const listingIntent = productIdFromQuery ?? validProductId;
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
        if (listingIntent != null && listingIntent > 0) {
          const current = parseConversationInt(conv.context_product_id);
          if (current !== listingIntent) {
            const { error: uErr } = await setConversationContextProduct(supabase, conv.id, listingIntent);
            if (!uErr) conv = { ...conv, context_product_id: listingIntent };
          }
        }
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
            { contextProductId: listingIntent ?? undefined },
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
          if (listingIntent != null && listingIntent > 0) {
            const { error: uErr } = await setConversationContextProduct(supabase, found.id, listingIntent);
            if (!uErr) conv = { ...conv, context_product_id: listingIntent };
          }
        }
        peer = peerFromUrl;
        if (conv && !threadIdParam && !legacyThreadId) {
          const productQs =
            listingIntent != null && Number.isFinite(listingIntent) && listingIntent > 0
              ? `?product=${listingIntent}`
              : "";
          navigate(`/messages/c/${conv.id}${productQs}`, { replace: true });
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

      setPeerVerified(false);
      setPeerMemberSince(null);
      setPeerLastActive(null);

      const profileSel =
        "full_name, avatar_url, gender, phone, state, lga, created_at, last_active";

      const pubPromise = supabase.from("profiles_public").select(profileSel).eq("id", peer).maybeSingle();
      const verPromise = supabase.from("seller_verification").select("id").eq("seller_id", peer).limit(1).maybeSingle();

      const [pubRes, verRes] = await Promise.all([pubPromise, verPromise]);

      let prof: Record<string, unknown> | null = null;
      if (!pubRes.error && pubRes.data) prof = pubRes.data as Record<string, unknown>;
      else {
        const fb = await supabase.from("profiles").select(profileSel).eq("id", peer).maybeSingle();
        if (!fb.error && fb.data) prof = fb.data as Record<string, unknown>;
      }

      if (prof) {
        const name = (prof.full_name as string)?.trim() || "Member";
        setPeerName(name);
        const av = prof.avatar_url;
        setPeerAvatarUrl(typeof av === "string" && av.trim() ? av.trim() : null);
        const g = prof.gender;
        setPeerGender(typeof g === "string" ? g : null);
        const created = typeof prof.created_at === "string" ? prof.created_at : null;
        setPeerMemberSince(formatMemberSince(created));
        const la = typeof prof.last_active === "string" ? prof.last_active : null;
        setPeerLastActive(la);
      } else {
        setPeerName("Member");
        setPeerAvatarUrl(null);
        setPeerGender(null);
      }

      if (!verRes.error && verRes.data) setPeerVerified(true);

      const { data: msgs, error: mErr } = await fetchChatMessagesForConversation(supabase, conv.id);
      if (mErr) throw new Error(mErr.message);
      setReplyingTo(null);
      setHighlightedMessageId(null);
      setEmojiPickerOpen(false);
      setMessages(msgs);
      void (async () => {
        try {
          const pending = await outboxListConversation(conv.id);
          if (pending.length === 0) return;
          setMessages((prev) => {
            const have = new Set(prev.map((x) => x.id));
            const add = pending.filter((p) => !have.has(p.localId)).map(outboxRecordToChatRow);
            if (add.length === 0) return prev;
            return resolveChatMessageReplyPreviews([...prev, ...add]);
          });
        } catch {
          /* noop */
        }
      })();

      const attachPid = listingIntent ?? parseConversationInt(conv.context_product_id);
      attachListingToFirstSendRef.current =
        attachPid != null && Number.isFinite(attachPid) && attachPid > 0;
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
  }, [authUser?.id, threadIdParam, peerRouteParam, legacyThreadId, validProductId, productIdFromQuery, navigate]);

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
    const pid = stripProductSourceId;
    if (!pid) {
      setStripProduct(null);
      setListingStripLoading(false);
      return;
    }
    let cancelled = false;
    setListingStripLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, title, price, price_local, image, like_count, condition")
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
          condition: typeof row.condition === "string" && row.condition.trim() ? row.condition.trim() : null,
        });
      } finally {
        if (!cancelled) setListingStripLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setListingStripLoading(false);
    };
  }, [stripProductSourceId]);

  /** Keep `conversations.context_product_id` aligned with `?product=` / persisted link intent. */
  useEffect(() => {
    const intent = productIdFromQuery ?? validProductId;
    if (!conversation?.id || intent == null) return;
    const cur = parseConversationInt(conversation.context_product_id);
    if (cur === intent) return;
    let cancelled = false;
    void (async () => {
      const { error } = await setConversationContextProduct(supabase, conversation.id, intent);
      if (cancelled || error) return;
      setConversation((c) => (c ? { ...c, context_product_id: intent } : c));
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, conversation?.context_product_id, productIdFromQuery, validProductId]);

  useEffect(() => {
    setMobileProductStripCollapsed(false);
  }, [stripProduct?.id]);

  useEffect(() => {
    setProductStripDismissed(false);
  }, [stripProductSourceId]);

  useEffect(() => {
    if (!authUser?.id || !peerId) {
      setIsFollowingPeer(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profile_follows")
        .select("follower_id")
        .eq("follower_id", authUser.id)
        .eq("following_id", peerId)
        .maybeSingle();
      if (!cancelled) setIsFollowingPeer(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, peerId]);

  useEffect(() => {
    if (!peerId) {
      setPeerFollowerCount(null);
      return;
    }
    let cancelled = false;
    void fetchProfileFollowerCount(supabase, peerId).then((n) => {
      if (!cancelled) setPeerFollowerCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [peerId]);

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
        .select("id, title, price, price_local, image, like_count, condition")
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
          condition: typeof row.condition === "string" && row.condition.trim() ? row.condition.trim() : null,
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
          if (peerId && row.sender_id === peerId && row.created_at) {
            setPeerLastActive(row.created_at);
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return resolveChatMessageReplyPreviews(prev);
            const cleaned =
              authUser?.id && isMessageFromViewer(row.sender_id, authUser.id)
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_reactions",
          filter: `conversation_id=eq.${mid}`,
        },
        () => {
          void refreshReactionsRef.current();
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
  }, [conversation?.id, authUser?.id, peerId]);

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
    const ch = supabase
      .channel(`peer-profile-la:${peerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${peerId}`,
        },
        (payload) => {
          const row = payload.new as { last_active?: string | null };
          if (row?.last_active && typeof row.last_active === "string") {
            setPeerLastActive(row.last_active);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [peerId]);

  /** Re-evaluate "Active now" when the 5-minute window can expire without a profile push. */
  useEffect(() => {
    if (!peerLastActive) return;
    const t = window.setInterval(() => setPeerPresenceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [peerLastActive]);

  useEffect(() => {
    if (!messages.length) return;
    if (atBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [messages, peerTyping, scrollToBottom]);

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

      if (!authUser?.id || !conversation) {
        toast.error("Chat is not ready.");
        return;
      }

      let productId = opts?.productId ?? null;
      if (productId == null && attachListingToFirstSendRef.current) {
        let n = parseConversationInt(conversation.context_product_id);
        if (n == null || n <= 0) {
          n = stripProductSourceId;
        }
        if (n != null && n > 0) {
          productId = n;
          attachListingToFirstSendRef.current = false;
        }
      } else if (productId != null) {
        attachListingToFirstSendRef.current = false;
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
        if (productId != null) {
          setProductIdFromQuery(null);
        }
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
    [authUser?.id, conversation, draft, replyingTo, scrollToBottom, stripProductSourceId],
  );

  const sendProductCard = useCallback(() => {
    const pid = conversation?.context_product_id ?? stripProduct?.id ?? stripProductSourceId ?? null;
    if (pid == null) {
      toast.message("No listing linked to this chat.");
      return;
    }
    void sendMessage({ text: "", productId: pid });
  }, [conversation?.context_product_id, stripProduct?.id, stripProductSourceId, sendMessage]);

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

  const copyText = useCallback(async (msg: ChatMessageRow, slice?: string) => {
    try {
      await navigator.clipboard.writeText(slice ?? (msg.message || ""));
      toast.success("Copied");
      setMobileSheetMsg(null);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const toggleFollowPeer = useCallback(async () => {
    if (!authUser?.id || !peerId) return;
    setFollowBusy(true);
    try {
      if (isFollowingPeer) {
        const { error } = await supabase
          .from("profile_follows")
          .delete()
          .eq("follower_id", authUser.id)
          .eq("following_id", peerId);
        if (error) throw error;
        setIsFollowingPeer(false);
        toast.message("Unfollowed");
      } else {
        const { error } = await supabase.from("profile_follows").insert({
          follower_id: authUser.id,
          following_id: peerId,
        });
        if (error) throw error;
        setIsFollowingPeer(true);
        toast.success("Following");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  }, [authUser?.id, peerId, isFollowingPeer]);

  const openForwardPicker = useCallback((msg: ChatMessageRow) => {
    setMobileSheetMsg(null);
    setForwardTarget(msg);
    setForwardOpen(true);
  }, []);

  const forwardToConversation = useCallback(
    async (targetConversationId: string) => {
      if (!authUser?.id || !forwardTarget) return;
      const msg = forwardTarget;
      const parts = [msg.message?.trim() ?? "", msg.image_url ? "[Image]" : "", msg.media_url ? "[Voice]" : ""].filter(
        Boolean,
      );
      const text = parts.join("\n");
      if (!text.trim() && !msg.image_url && !msg.media_url) {
        toast.message("Nothing to forward");
        return;
      }
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: targetConversationId,
        sender_id: authUser.id,
        message: text || (msg.image_url ? "Photo" : msg.media_url ? "Voice" : ""),
        image_url: msg.image_url ?? null,
        media_url: msg.media_url ?? null,
        product_id: msg.product_id ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setForwardOpen(false);
      setForwardTarget(null);
      toast.success("Forwarded");
    },
    [authUser?.id, forwardTarget],
  );

  const openMessageActions = useCallback((msg: ChatMessageRow) => {
    if (String(msg.id).startsWith("pending-")) return;
    setMenuSelectedText((document.getSelection()?.toString() ?? "").trim());
    setMobileSheetMsg(msg);
  }, []);

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

  const deleteForMe = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id) return;
      setMobileSheetMsg(null);
      const prev = msg.deleted_for ?? [];
      if (prev.includes(authUser.id)) return;
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_for: [...prev, authUser.id] })
        .eq("id", msg.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setMessages((m) =>
        m.map((row) => (row.id === msg.id ? { ...row, deleted_for: [...prev, authUser.id] } : row)),
      );
      toast.success("Removed from this chat");
    },
    [authUser?.id],
  );

  const deleteForEveryone = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id || !canDeleteMessageForEveryone(msg, authUser.id)) return;
      setMobileSheetMsg(null);
      const { error } = await supabase
        .from("chat_messages")
        .update({
          deleted_for_everyone: true,
          message: CHAT_MESSAGE_DELETED_PLACEHOLDER,
          image_url: null,
          media_url: null,
          product_id: null,
        })
        .eq("id", msg.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Deleted for everyone");
    },
    [authUser?.id],
  );

  const startEdit = useCallback((msg: ChatMessageRow) => {
    if (!canEditMessage(msg, authUser?.id)) return;
    setMobileSheetMsg(null);
    setEditTarget(msg);
    setEditText(msg.message || "");
    setEditOpen(true);
  }, [authUser?.id]);

  const saveEdit = useCallback(async () => {
    if (!authUser?.id || !editTarget) return;
    const text = editText.trim();
    if (!text) {
      toast.error("Message cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("chat_messages")
      .update({
        message: text,
        edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", editTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditOpen(false);
    setEditTarget(null);
    toast.success("Message updated");
  }, [authUser?.id, editTarget, editText]);

  const toggleStarMsg = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id) return;
      const starred = savedMessageIds.has(msg.id);
      const { error } = await toggleSavedMessage(supabase, {
        userId: authUser.id,
        messageId: msg.id,
        currentlyStarred: starred,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSavedMessageIds((prev) => {
        const n = new Set(prev);
        if (starred) n.delete(msg.id);
        else n.add(msg.id);
        return n;
      });
      setMobileSheetMsg(null);
      toast.message(starred ? "Removed from saved" : "Saved");
    },
    [authUser?.id, savedMessageIds],
  );

  const pinMsg = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id || !conversation?.id) return;
      setMobileSheetMsg(null);
      const { error } = await upsertPinnedMessage(supabase, {
        conversationId: conversation.id,
        messageId: msg.id,
        pinnedBy: authUser.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      void fetchPinnedMessage(supabase, conversation.id).then(({ data, error: e }) => {
        if (!e && data) setPinnedRow(data);
      });
      toast.success("Pinned");
    },
    [authUser?.id, conversation?.id],
  );

  const openInfo = useCallback((msg: ChatMessageRow) => {
    setMobileSheetMsg(null);
    setInfoMsg(msg);
    setInfoOpen(true);
  }, []);

  const unpinBanner = useCallback(async () => {
    if (!conversation?.id) return;
    const { error } = await unpinConversation(supabase, conversation.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPinnedRow(null);
    toast.message("Unpinned");
  }, [conversation?.id]);

  const onReactFromMenu = useCallback(
    async (emoji: string, msg: ChatMessageRow) => {
      if (!conversation?.id || !authUser?.id) return;
      const mid = msg.id;
      const cur = reactionByMessage[mid]?.myEmoji;
      try {
        if (cur === emoji) {
          const { error } = await removeOwnMessageReaction(supabase, mid, authUser.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await setMessageReaction(supabase, {
            conversationId: conversation.id,
            messageId: mid,
            userId: authUser.id,
            emoji,
          });
          if (error) throw new Error(error.message);
        }
        setMobileSheetMsg(null);
        await refreshReactions();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not react");
      }
    },
    [conversation?.id, authUser?.id, reactionByMessage, refreshReactions],
  );

  const runConfirm = useCallback(async () => {
    if (!pendingConfirm || actionBusy) return;
    setActionBusy(true);
    try {
      if (pendingConfirm.kind === "delete-conversation") {
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
        const { error } = await clearConversationForMe(supabase, cid);
        if (error) throw new Error(error.message);
        const { data: msgs, error: mErr } = await fetchChatMessagesForConversation(supabase, cid);
        if (mErr) throw new Error(mErr.message);
        setMessages(msgs);
        setReplyingTo(null);
        setPinnedRow(null);
        toast.success("Chat cleared for you");
      } else if (pendingConfirm.kind === "clear-chat-both") {
        const cid = conversation?.id;
        if (!cid) {
          toast.error("Conversation not ready.");
          return;
        }
        const { error } = await clearConversationMessages(supabase, cid);
        if (error) throw new Error(error.message);
        const { data: msgs, error: mErr } = await fetchChatMessagesForConversation(supabase, cid);
        if (mErr) throw new Error(mErr.message);
        setMessages(msgs);
        setReplyingTo(null);
        setPinnedRow(null);
        toast.success("Chat cleared for both of you");
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Action failed"));
    } finally {
      setActionBusy(false);
      setPendingConfirm(null);
    }
  }, [actionBusy, conversation?.id, navigate, pendingConfirm]);

  const jumpToMessage = useCallback((id: string | null | undefined) => {
    if (!id) return;
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(id);
      window.setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  const beginReplyTo = useCallback((msg: ChatMessageRow | null | undefined) => {
    if (!msg) return;
    setReplyingTo(msg);
    setMobileSheetMsg(null);
    requestAnimationFrame(() => {
      const ta = draftTextareaRef.current;
      ta?.focus();
      ta?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const chatShellStyle = {
    ...(viewportHeight ? { ["--chat-viewport-height" as string]: `${viewportHeight}px` } : {}),
    ["--chat-header-height" as string]: `${peerHeaderHeight}px`,
  } as React.CSSProperties;

  const filteredThreadSearch = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.message || "").toLowerCase().includes(q));
  }, [messages, threadSearch]);

  const pinnedPreviewText = useMemo(() => {
    if (!pinnedRow) return "";
    const m = messages.find((x) => x.id === pinnedRow.message_id);
    return m ? messagePreviewText(m.message, m.image_url) : "Original message unavailable";
  }, [pinnedRow, messages]);

  /** Most recent own message that is still editable (15 min window). */
  const lastOwnMessageToEdit = useMemo(() => {
    if (!authUser?.id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (String(m.id).startsWith("pending-")) continue;
      if (isDeletedForEveryone(m)) continue;
      if (!isMessageFromViewer(m.sender_id, authUser.id)) continue;
      if (canEditMessage(m, authUser.id)) return m;
    }
    return null;
  }, [messages, authUser?.id]);

  const menuMine = mobileSheetMsg ? isMessageFromViewer(mobileSheetMsg.sender_id, authUser?.id) : false;

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
    if (loadError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-medium text-gray-800 dark:text-foreground">Chat could not be loaded.</p>
          <p className="max-w-md text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" asChild>
            <Link to="/messages">Back to messages</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        Loading conversation…
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
                <div
                  key={row.id}
                  className={`flex items-center gap-3 border-b border-gray-50 p-3 dark:border-zinc-800 sm:p-4 ${
                    active ? "bg-emerald-50/80 dark:bg-emerald-950/40" : ""
                  }`}
                >
                  <Link
                    to={`/profile/${oid}`}
                    className="shrink-0 rounded-full ring-offset-2 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e]"
                    aria-label={`View ${name}'s profile`}
                  >
                    <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <Link
                        to={`/profile/${oid}`}
                        className="min-w-0 truncate font-semibold text-gray-800 hover:underline dark:text-foreground"
                      >
                        {name}
                      </Link>
                      <Link
                        to={`/messages/c/${row.id}`}
                        className="ml-2 flex shrink-0 items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
                      >
                        {(inboxUnreadByConv.get(row.id) ?? 0) > 0 ? (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#22c55e] px-1 text-[10px] font-bold text-white">
                            {inboxUnreadByConv.get(row.id)! > 99 ? "99+" : inboxUnreadByConv.get(row.id)}
                          </span>
                        ) : null}
                        <span className="text-xs">{formatListTime(row.last_message_at)}</span>
                      </Link>
                    </div>
                    <Link
                      to={`/messages/c/${row.id}`}
                      className={`block rounded-xl py-0.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 ${
                        active ? "" : ""
                      }`}
                    >
                      {aboutProduct ? (
                        <p className="mb-0.5 truncate text-xs font-medium text-[#16a34a]">Re: {aboutProduct}</p>
                      ) : null}
                      <p
                        className={`line-clamp-2 text-sm ${row.last_message ? "text-gray-700 dark:text-zinc-300" : "italic text-gray-400"}`}
                      >
                        {row.last_message || "No messages yet — say hello"}
                      </p>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const chatPanel = (
    <>
      <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#e5ddd5] dark:bg-zinc-950">
        {/* Mobile: fixed below TopNav so it stays visible while typing / scrolling; md+: sticky in column. */}
        <header
          ref={peerHeaderRef}
          className={cn(
            "shrink-0 overflow-visible border-b border-[#d1d7db] bg-[#f0f2f5] shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
            "max-md:fixed max-md:left-0 max-md:right-0 max-md:top-16 max-md:z-40",
            "md:sticky md:top-16 md:z-30",
          )}
        >
          {stripProductSourceId != null && listingStripLoading && !stripProduct ? (
            <div
              className="shrink-0 border-b border-[#d1d7db] bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/80 sm:px-4"
              aria-busy
              aria-label="Loading listing"
            >
              <div className="flex animate-pulse items-center gap-3">
                <span className="h-14 w-14 shrink-0 rounded-lg bg-gray-200 dark:bg-zinc-700" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-[min(100%,14rem)] rounded bg-gray-200 dark:bg-zinc-700" />
                  <div className="h-3 w-24 rounded bg-gray-100 dark:bg-zinc-600/80" />
                </div>
                <span className="h-9 w-24 shrink-0 rounded-md bg-gray-200 dark:bg-zinc-700" />
              </div>
            </div>
          ) : stripProductSourceId != null && !stripProduct && !listingStripLoading && !productStripDismissed ? (
            <div className="shrink-0 border-b border-[#d1d7db] bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-zinc-700 dark:bg-amber-950/40 dark:text-amber-100 sm:px-4">
              <span className="font-medium">Listing #{stripProductSourceId}</span>
              <span className="text-amber-800/90 dark:text-amber-200/90"> — details couldn&apos;t be loaded. You can still message about this product.</span>
            </div>
          ) : stripProduct && !productStripDismissed ? (
            <div className="shrink-0 border-b border-[#d1d7db] bg-white dark:border-zinc-700 dark:bg-zinc-800/80">
              {mobileProductStripCollapsed ? (
                <button
                  type="button"
                  className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left md:hidden sm:px-4"
                  onClick={() => setMobileProductStripCollapsed(false)}
                  aria-expanded={false}
                  aria-controls="chat-product-strip-details"
                >
                  <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-gray-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {stripProduct.title}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#25D366]">{formatPrice(stripProduct.price)}</span>
                </button>
              ) : null}

              <div
                id="chat-product-strip-details"
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 sm:px-4",
                  mobileProductStripCollapsed ? "hidden md:flex" : "flex",
                )}
              >
                <button
                  type="button"
                  className="absolute right-28 top-2 z-10 min-h-[44px] min-w-[44px] rounded-full p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:hover:bg-zinc-700"
                  aria-label="Hide listing details"
                  onClick={() => setMobileProductStripCollapsed(true)}
                >
                  <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
                </button>
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5 dark:bg-zinc-800">
                  {stripProduct.image ? (
                    <img src={stripProduct.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No image</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">{stripProduct.title}</p>
                  <p className="text-sm font-bold text-[#25D366]">{formatPrice(stripProduct.price)}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" className="min-h-[44px] shrink-0 px-3" asChild>
                  <Link to={`/products/${stripProduct.id}`}>View product</Link>
                </Button>
                <button
                  type="button"
                  onClick={() => setProductStripDismissed(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  aria-label="Dismiss product banner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}
          <ChatPeerHeaderModern
            peerId={peerId}
            peerName={peerName}
            avatarSrc={peerAvatarDisplay}
            followerCount={peerFollowerCount}
            lastSeenShort={
              peerTyping || peerActiveByProfile ? null : peerLastActive ? formatListTime(peerLastActive) : null
            }
            isTyping={peerTyping}
            isOnline={false}
            isActiveNow={peerActiveByProfile}
            onBack={() => navigate("/messages")}
            className={cn(
              stripProductSourceId != null ? "border-t border-[#d1d7db] dark:border-zinc-700" : "",
              "bg-[#f0f2f5]/95 dark:bg-zinc-900/95",
            )}
            menu={
              <>
                {peerMemberSince ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Member since {peerMemberSince}
                  </DropdownMenuLabel>
                ) : null}
                {peerMemberSince ? <DropdownMenuSeparator /> : null}
                {peerId ? (
                  <DropdownMenuItem asChild>
                    <Link to={`/profile/${peerId}`} className="flex cursor-pointer items-center gap-2">
                      <User className="h-4 w-4" />
                      View profile
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={followBusy}
                  onSelect={(e) => {
                    e.preventDefault();
                    void toggleFollowPeer();
                  }}
                >
                  {isFollowingPeer ? <UserCheck className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {isFollowingPeer ? "Unfollow" : "Follow"}
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
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSearchOpen((v) => !v);
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search in chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!lastOwnMessageToEdit}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (lastOwnMessageToEdit) startEdit(lastOwnMessageToEdit);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit last message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setReportOpen(true);
                  }}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Report / Scammer alert
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
              </>
            }
          />
          {searchOpen ? (
            <div className="flex items-center gap-2 border-t border-emerald-100/80 bg-white/90 px-3 py-2 dark:border-emerald-900 dark:bg-zinc-800/90 sm:px-4">
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
        </header>
        {/* Reserves space for fixed header on small screens (header is out of flow when fixed). */}
        <div
          className="max-md:shrink-0 md:hidden"
          style={{ minHeight: peerHeaderHeight, height: peerHeaderHeight }}
          aria-hidden
        />

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
            dir="ltr"
            className="chat-messages min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#e5ddd5] px-2 py-2 sm:px-3 [-webkit-overflow-scrolling:touch] dark:bg-zinc-950"
          >
            <div className="flex flex-col pb-1">
              {pinnedRow ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                  <Pin className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-sm"
                    onClick={() => jumpToMessage(pinnedRow.message_id)}
                  >
                    <span className="font-semibold text-amber-900 dark:text-amber-200">Pinned message</span>
                    <p className="truncate text-xs text-amber-900/80 dark:text-amber-100/80">{pinnedPreviewText}</p>
                  </button>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => void unpinBanner()}>
                    Unpin
                  </Button>
                </div>
              ) : null}
              {messages.map((msg, i) => {
                if (authUser?.id && isMessageHiddenForViewer(msg, authUser.id)) {
                  return <Fragment key={msg.id} />;
                }

                const prev = i > 0 ? messages[i - 1] : null;
                const next = i < messages.length - 1 ? messages[i + 1] : null;
                const showDayDivider = !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
                const sameCluster =
                  !!prev && prev.sender_id === msg.sender_id && withinMinutes(prev.created_at, msg.created_at, 8);
                const sameNextCluster =
                  !!next && next.sender_id === msg.sender_id && withinMinutes(msg.created_at, next.created_at, 8);
                const showMeta = !sameNextCluster;
                const mine = isMessageFromViewer(msg.sender_id, authUser?.id);
                const t = new Date(msg.created_at);
                const timeLabel = Number.isNaN(t.getTime())
                  ? ""
                  : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const replyPreview = msg.reply_preview;
                const quotedSender = replyPreview ? senderLabel(replyPreview.sender_id) : "Message";
                const isHighlighted = highlightedMessageId === msg.id;
                const productCard = resolveMessageProductCard(msg);
                const dfe = isDeletedForEveryone(msg);

                const actionsDisabled = String(msg.id).startsWith("pending-") || dfe;

                const messageBubbleEl = (
                  <MessageBubble
                    mine={mine}
                    timeLabel={timeLabel}
                    showMeta={showMeta}
                    receiptPhase={outgoingReceiptPhase(msg)}
                    showIncomingRead={!mine && !!msg.read_at}
                    isHighlighted={isHighlighted}
                    edited={!!msg.edited}
                    reactions={reactionByMessage[msg.id]?.summaries ?? null}
                    onRequestActions={actionsDisabled ? undefined : () => openMessageActions(msg)}
                    actionsDisabled={actionsDisabled}
                    replySlot={
                      replyPreview || msg.reply_to_id ? (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToMessage(replyPreview?.id ?? msg.reply_to_id);
                          }}
                          className={`mb-2 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition ${
                            mine
                              ? "border-white/70 bg-black/10 text-white"
                              : "border-gray-400 bg-gray-100 text-gray-900 dark:bg-zinc-600/80 dark:text-zinc-100"
                          }`}
                        >
                          <p className="truncate text-[11px] font-semibold opacity-90">{quotedSender}</p>
                          <p className="line-clamp-2 text-[12px] leading-snug opacity-90">
                            {replyPreview
                              ? messagePreviewText(replyPreview.message, replyPreview.image_url)
                              : "Original message"}
                          </p>
                        </button>
                      ) : null
                    }
                    belowBubbleSlot={
                      productCard && !dfe ? (
                        <ChatPortraitProductCard
                          productId={productCard.strip.id}
                          title={productCard.strip.title}
                          priceLabel={productCard.pricePending ? "…" : formatPrice(productCard.strip.price)}
                          imageUrl={productCard.strip.image}
                          disableLink={false}
                        />
                      ) : null
                    }
                  >
                    <div className="space-y-2">
                      {msg.image_url && !dfe ? (
                        <img
                          src={msg.image_url}
                          alt=""
                          className="max-h-64 max-w-full rounded-md object-cover"
                          loading="lazy"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      {msg.media_url && !dfe ? (
                        <audio
                          src={msg.media_url}
                          controls
                          className="max-w-[min(100%,280px)]"
                          preload="metadata"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      {msg.message?.trim() && !dfe ? (
                        <p
                          className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${mine ? "text-white" : "text-inherit"}`}
                        >
                          {msg.message}
                        </p>
                      ) : null}
                      {dfe ? (
                        <p className={`text-sm italic ${mine ? "text-white/90" : "text-gray-600 dark:text-zinc-300"}`}>
                          This message was deleted.
                        </p>
                      ) : null}
                      {msg.client_sending ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] ${mine ? "text-white/85" : "opacity-80"}`}>
                          <Loader2 className="h-3 w-3 animate-spin" /> Sending…
                        </span>
                      ) : null}
                    </div>
                  </MessageBubble>
                );

                const rowBody = (
                  <div className="block w-full min-w-0 flex-1 touch-manipulation">{messageBubbleEl}</div>
                );

                const ctxReactions = (
                  <div className="flex flex-wrap gap-1 border-b border-gray-100 px-1 py-2 dark:border-zinc-800">
                    {MESSAGE_QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                        onClick={() => {
                          void onReactFromMenu(emoji, msg);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                );

                const menuItems = (
                  <>
                    {ctxReactions}
                    <ContextMenuItem
                      onSelect={() => {
                        beginReplyTo(msg);
                      }}
                    >
                      <Reply className="mr-2 h-4 w-4" />
                      Reply
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void copyText(msg)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!menuSelectedText.trim()}
                      onSelect={() => void copyText(msg, menuSelectedText)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy selected text
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => openForwardPicker(msg)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Forward
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void toggleStarMsg(msg)}>
                      <Star className="mr-2 h-4 w-4" />
                      {savedMessageIds.has(msg.id) ? "Unstar message" : "Star message"}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => openInfo(msg)}>Info</ContextMenuItem>
                    {mine && canEditMessage(msg, authUser?.id) ? (
                      <ContextMenuItem onSelect={() => startEdit(msg)}>Edit</ContextMenuItem>
                    ) : null}
                    {mine ? <ContextMenuItem onSelect={() => void pinMsg(msg)}>Pin</ContextMenuItem> : null}
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Eraser className="mr-2 h-4 w-4" />
                        Clear chat
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="min-w-[12rem]">
                        <ContextMenuItem
                          onSelect={() => {
                            setMobileSheetMsg(null);
                            setPendingConfirm({ kind: "clear-chat" });
                          }}
                        >
                          Clear for me
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            setMobileSheetMsg(null);
                            setPendingConfirm({ kind: "clear-chat-both" });
                          }}
                        >
                          Clear for both
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="text-destructive focus:text-destructive data-[state=open]:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="min-w-[12rem]">
                        <ContextMenuItem variant="destructive" onSelect={() => void deleteForMe(msg)}>
                          Delete for me
                        </ContextMenuItem>
                        {mine && canDeleteMessageForEveryone(msg, authUser?.id) ? (
                          <ContextMenuItem variant="destructive" onSelect={() => void deleteForEveryone(msg)}>
                            Delete for everyone
                          </ContextMenuItem>
                        ) : null}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </>
                );

                return (
                  <Fragment key={msg.id}>
                    {showDayDivider ? (
                      <div className="mb-3 flex justify-center">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-white/10">
                          {dayDividerLabel(msg.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      ref={(node) => {
                        if (node) messageRefs.current.set(msg.id, node);
                        else messageRefs.current.delete(msg.id);
                      }}
                      className={cn("flex w-full items-start", sameCluster ? "mb-0.5" : "mb-2")}
                    >
                      {useDesktopContextMenu ? (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>{rowBody}</ContextMenuTrigger>
                          <ContextMenuContent className="min-w-[12rem]">{menuItems}</ContextMenuContent>
                        </ContextMenu>
                      ) : (
                        rowBody
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

          <div className="relative z-30 shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-2 py-2 sm:px-3">
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

              {stripProductSourceId != null && !productStripDismissed ? (
                <div className="mb-2 md:hidden">
                  <ComposerAttachedListing
                    productId={stripProduct?.id ?? stripProductSourceId}
                    title={stripProduct?.title ?? "Listing"}
                    priceLabel={stripProduct ? formatPrice(stripProduct.price) : "…"}
                    imageUrl={stripProduct?.image ?? null}
                    onDismiss={() => setProductStripDismissed(true)}
                  />
                </div>
              ) : null}

              <ChatInputBar
                draft={draft}
                onDraftChange={setDraft}
                onSend={() => void sendMessage()}
                sendBusy={sendBusy}
                draftTextareaRef={draftTextareaRef}
                attachInputRef={attachInputRef}
                onAttachChange={onPickImage}
                attachAccept="image/*"
                emojiPickerOpen={emojiPickerOpen}
                onEmojiPickerOpenChange={setEmojiPickerOpen}
                emojiList={CHAT_EMOJI_GRID}
                onEmojiInsert={insertEmoji}
                enableMic
                recording={recording}
                onMicPointerDown={onMicPointerDown}
                attachIcon="image-plus"
                leadingExtras={
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void sendProductCard()}
                    disabled={stripProductSourceId == null}
                    className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors duration-200 hover:bg-black/[0.06] disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-white/10"
                    aria-label="Share listing"
                    title="Share product card"
                  >
                    <Package className="h-6 w-6" />
                  </button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {mobileSheetMsg ? (
        <MessageMenuV2
          open={!!mobileSheetMsg}
          onOpenChange={(o) => {
            if (!o) setMobileSheetMsg(null);
          }}
          selectedText={menuSelectedText}
          isMine={menuMine}
          onReply={() => {
            beginReplyTo(mobileSheetMsg);
          }}
          onCopy={() => void copyText(mobileSheetMsg)}
          onCopySelected={() => void copyText(mobileSheetMsg, menuSelectedText)}
          onForward={() => openForwardPicker(mobileSheetMsg)}
          onToggleStar={() => void toggleStarMsg(mobileSheetMsg)}
          isStarred={savedMessageIds.has(mobileSheetMsg.id)}
          onInfo={() => openInfo(mobileSheetMsg)}
          onEdit={menuMine && canEditMessage(mobileSheetMsg, authUser?.id) ? () => startEdit(mobileSheetMsg) : undefined}
          onPin={menuMine ? () => void pinMsg(mobileSheetMsg) : undefined}
          onDeleteForMe={() => void deleteForMe(mobileSheetMsg)}
          onDeleteForEveryone={
            menuMine && canDeleteMessageForEveryone(mobileSheetMsg, authUser?.id)
              ? () => void deleteForEveryone(mobileSheetMsg)
              : undefined
          }
          onReact={(emoji) => void onReactFromMenu(emoji, mobileSheetMsg)}
          showEdit={!!(menuMine && canEditMessage(mobileSheetMsg, authUser?.id))}
          showDeleteForEveryone={!!(menuMine && canDeleteMessageForEveryone(mobileSheetMsg, authUser?.id))}
          myReaction={reactionByMessage[mobileSheetMsg.id]?.myEmoji ?? null}
          onClearChatForMe={
            conversation?.id
              ? () => {
                  setPendingConfirm({ kind: "clear-chat" });
                }
              : undefined
          }
          onClearChatForBoth={
            conversation?.id
              ? () => {
                  setPendingConfirm({ kind: "clear-chat-both" });
                }
              : undefined
          }
        />
      ) : null}

      <ReportUserDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reporterId={authUser?.id}
        reportedUserId={peerId}
      />

      <MessageInfoDialog
        open={infoOpen}
        onOpenChange={(o) => {
          setInfoOpen(o);
          if (!o) setInfoMsg(null);
        }}
        message={infoMsg}
        isMine={infoMsg ? isMessageFromViewer(infoMsg.sender_id, authUser?.id) : false}
        peerFirstName={peerFirstName}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
          </DialogHeader>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
        <DialogContent className="max-h-[min(80vh,560px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward to…</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
            {conversation &&
              inboxFiltered
                .filter((row) => row.id !== conversation.id)
                .map((row) => {
                  const oid = inboxOtherPartyUserId(row);
                  if (!oid) return null;
                  const p = inboxProfiles.get(oid);
                  const name = p?.full_name?.trim() || "Member";
                  const av = getAvatarUrl(p?.avatar_url ?? null, p?.gender ?? null, name);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-800"
                      onClick={() => void forwardToConversation(row.id)}
                    >
                      <img src={av} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <span className="font-medium">{name}</span>
                    </button>
                  );
                })}
            {conversation &&
            inboxFiltered.filter((row) => row.id !== conversation.id).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No other conversations yet.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForwardOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingConfirm != null} onOpenChange={(open) => !open && setPendingConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.kind === "delete-conversation"
                ? "Delete conversation?"
                : pendingConfirm?.kind === "clear-chat-both"
                  ? "Clear chat for both?"
                  : "Clear chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.kind === "delete-conversation"
                ? "This deletes the conversation and returns you to the inbox."
                : pendingConfirm?.kind === "clear-chat-both"
                  ? `This removes all messages in this chat for you and ${peerFirstName}. This cannot be undone.`
                  : `All messages in this chat will be hidden only for you. ${peerFirstName} will still see the full history.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className={
                pendingConfirm?.kind === "clear-chat"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
              }
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
