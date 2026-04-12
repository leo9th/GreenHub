import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  Ban,
  CheckSquare,
  ChevronDown,
  Copy,
  Eraser,
  FileText,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Pencil,
  Package,
  Reply,
  Search,
  Send,
  Share2,
  Smile,
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
  CHAT_MESSAGE_BASE_COLUMNS,
  CHAT_MESSAGE_DELETED_FOR_ME_PLACEHOLDER,
  CHAT_MESSAGE_DELETED_PLACEHOLDER,
  fetchChatMessagesForConversation,
  markConversationMessagesDelivered,
  markConversationMessagesRead,
  normalizeChatMessageRow,
  outgoingReceiptPhase,
  resolveChatMessageReplyPreviews,
  canEditMessage,
  fetchMessageReactions,
  isDeletedForEveryone,
  isMessageHiddenForViewer,
  removeOwnMessageReaction,
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { MessageBubble } from "./MessageBubble";
import { ChatPortraitProductCard } from "./ChatPortraitProductCard";

const CHAT_MEDIA_BUCKETS = ["chat-media", "chat-images", "chat-attachments"] as const;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VOICE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 15 * 1024 * 1024;

const DOC_PICKER_ACCEPT =
  "image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isVoiceMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes("/voice-") || /\.(webm|m4a|ogg|mp3|wav)(\?|$)/.test(u);
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

/** Shown on mobile long-press sheet — common chat reactions (horizontal strip). */
const MESSAGE_SHEET_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✨"] as const;

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
  | { kind: "delete-for-me"; message: ChatMessageRow }
  | { kind: "delete-for-everyone"; message: ChatMessageRow }
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

  const atBottomRef = useRef(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [pendingBelow, setPendingBelow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const attachInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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
  const [reactionApplyBusy, setReactionApplyBusy] = useState(false);
  /** Multi-select own messages for bulk delete */
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessageRow | null>(null);
  const [isFollowingPeer, setIsFollowingPeer] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
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

  /** Prefer `?product=` from the listing link so the strip loads even before DB sync. */
  const stripProductSourceId = useMemo(() => {
    if (validProductId != null && validProductId > 0) return validProductId;
    const c = conversation ? parseConversationInt(conversation.context_product_id) : null;
    return c != null && c > 0 ? Math.trunc(c) : null;
  }, [validProductId, conversation?.context_product_id]);

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
    bulkSelectMode,
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
        if (validProductId) {
          const current = parseConversationInt(conv.context_product_id);
          if (current !== validProductId) {
            const { error: uErr } = await setConversationContextProduct(supabase, conv.id, validProductId);
            if (!uErr) conv = { ...conv, context_product_id: validProductId };
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
          const productQs =
            validProductId != null && Number.isFinite(validProductId) && validProductId > 0
              ? `?product=${validProductId}`
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

      attachListingToFirstSendRef.current =
        validProductId != null && Number.isFinite(validProductId) && validProductId > 0;
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

  /** Keep `conversations.context_product_id` aligned with `?product=` from the product page. */
  useEffect(() => {
    if (!conversation?.id || validProductId == null) return;
    const cur = parseConversationInt(conversation.context_product_id);
    if (cur === validProductId) return;
    let cancelled = false;
    void (async () => {
      const { error } = await setConversationContextProduct(supabase, conversation.id, validProductId);
      if (cancelled || error) return;
      setConversation((c) => (c ? { ...c, context_product_id: validProductId } : c));
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, conversation?.context_product_id, validProductId]);

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

  useEffect(() => {
    setBulkSelectMode(false);
    setSelectedMessageIds([]);
  }, [conversation?.id]);

  useEffect(() => {
    setEditingMessage(null);
  }, [conversation?.id]);

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
      documentFile?: File | null;
      voiceBlob?: Blob | null;
      voiceMime?: string;
      productId?: number | null;
    }) => {
      const text = (opts?.text ?? draft).trim();
      const imageFile = opts?.imageFile;
      const documentFile = opts?.documentFile;
      const voiceBlob = opts?.voiceBlob;

      if (!authUser?.id || !conversation) {
        toast.error("Chat is not ready.");
        return;
      }

      if (editingMessage) {
        const newText = (opts?.text ?? draft).trim();
        if (!newText) {
          toast.message("Message is empty.");
          return;
        }
        if (!canEditMessage(editingMessage, authUser.id)) {
          toast.error("You can only edit messages within 15 minutes.");
          setEditingMessage(null);
          return;
        }
        if (sendLockRef.current) return;
        sendLockRef.current = true;
        setSendBusy(true);
        try {
          const { error } = await supabase
            .from("chat_messages")
            .update({
              message: newText,
              edited: true,
              edited_at: new Date().toISOString(),
            })
            .eq("id", editingMessage.id);
          if (error) throw error;
          setMessages((prev) =>
            resolveChatMessageReplyPreviews(
              prev.map((m) =>
                m.id === editingMessage.id
                  ? { ...m, message: newText, edited: true, edited_at: new Date().toISOString(), client_sending: false }
                  : m,
              ),
            ),
          );
          setEditingMessage(null);
          setDraft("");
          toast.success("Message updated");
        } catch (e: unknown) {
          toast.error(errorMessage(e, "Could not edit message"));
        } finally {
          sendLockRef.current = false;
          setSendBusy(false);
        }
        return;
      }

      let productId = opts?.productId ?? null;
      if (productId == null && attachListingToFirstSendRef.current) {
        const ctx = conversation.context_product_id;
        if (ctx != null) {
          const n = parseConversationInt(ctx);
          if (n != null && n > 0) {
            productId = n;
            attachListingToFirstSendRef.current = false;
          }
        }
      } else if (productId != null) {
        attachListingToFirstSendRef.current = false;
      }
      if (!text && !imageFile && !documentFile && !voiceBlob && productId == null) {
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

        else if (documentFile) {
          if (documentFile.size > MAX_DOC_BYTES) {
            toast.error(`File too large (max ${formatBytes(MAX_DOC_BYTES)})`);
            setSendBusy(false);
            return;
          }
          const ext = documentFile.name.split(".").pop() || "bin";
          const path = `${conversation.id}/${authUser.id}/doc-${crypto.randomUUID()}.${ext}`;
          mediaUrl = await uploadChatMedia(path, documentFile, documentFile.type || undefined);
          if (!outgoingMessage.trim()) outgoingMessage = documentFile.name;
        } else if (voiceBlob) {
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
    [authUser?.id, conversation, draft, editingMessage, replyingTo, scrollToBottom],
  );

  const sendProductCard = useCallback(() => {
    if (editingMessage) {
      toast.message("Finish editing before sharing a listing.");
      return;
    }
    const pid = conversation?.context_product_id ?? stripProduct?.id ?? null;
    if (pid == null) {
      toast.message("No listing linked to this chat.");
      return;
    }
    void sendMessage({ text: "", productId: pid });
  }, [conversation?.context_product_id, stripProduct?.id, sendMessage, editingMessage]);

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
      if (editingMessage) {
        toast.message("Finish editing before attaching media.");
        return;
      }
      void sendMessage({ imageFile: file });
    },
    [sendMessage, editingMessage],
  );

  const onPickDocument = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (editingMessage) {
        toast.message("Finish editing before attaching media.");
        return;
      }
      void sendMessage({ documentFile: file });
    },
    [sendMessage, editingMessage],
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

  const forwardSingleMessage = useCallback(async (msg: ChatMessageRow) => {
    const parts = [
      msg.message?.trim() ?? "",
      msg.image_url ? "[Image]" : "",
      msg.media_url ? (isVoiceMediaUrl(msg.media_url) ? "[Voice]" : "[File]") : "",
    ].filter(Boolean);
    const text = parts.join("\n");
    if (!text.trim()) {
      toast.message("Nothing to forward");
      return;
    }
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied for forwarding");
      }
    } catch {
      /* user cancelled share */
    }
    setMobileSheetMsg(null);
  }, []);

  const openMessageActions = useCallback((msg: ChatMessageRow) => {
    if (String(msg.id).startsWith("pending-")) return;
    if (bulkSelectMode) return;
    setMobileSheetMsg(msg);
  }, [bulkSelectMode]);

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedMessageIds([]);
  }, []);

  const toggleMessageSelected = useCallback((msg: ChatMessageRow) => {
    if (msg.sender_id !== authUser?.id || String(msg.id).startsWith("pending-")) return;
    setSelectedMessageIds((prev) => {
      const i = prev.indexOf(msg.id);
      if (i >= 0) return prev.filter((id) => id !== msg.id);
      return [...prev, msg.id];
    });
  }, [authUser?.id]);

  const deleteSelectedMessages = useCallback(async () => {
    if (!authUser?.id || selectedMessageIds.length === 0) return;
    const deletable = selectedMessageIds.filter((id) => {
      const m = messages.find((x) => x.id === id);
      return m && m.sender_id === authUser.id && !String(id).startsWith("pending-");
    });
    if (deletable.length === 0) {
      toast.message("Select your own messages to delete.");
      return;
    }
    setBulkDeleteBusy(true);
    try {
      const { error } = await supabase.from("chat_messages").delete().in("id", deletable);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => !deletable.includes(m.id)));
      setReplyingTo((r) => (r && deletable.includes(r.id) ? null : r));
      exitBulkSelectMode();
      toast.success(deletable.length === 1 ? "Message deleted" : `${deletable.length} messages deleted`);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Could not delete messages"));
    } finally {
      setBulkDeleteBusy(false);
    }
  }, [authUser?.id, selectedMessageIds, messages, exitBulkSelectMode]);

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

  const requestDeleteForMe = useCallback((msg: ChatMessageRow) => {
    setMobileSheetMsg(null);
    setPendingConfirm({ kind: "delete-for-me", message: msg });
  }, []);

  const requestDeleteForEveryone = useCallback((msg: ChatMessageRow) => {
    setMobileSheetMsg(null);
    setPendingConfirm({ kind: "delete-for-everyone", message: msg });
  }, []);

  const mobileSheetMeta = useMemo(() => {
    const m = mobileSheetMsg;
    if (!m) return null;
    const deletedEveryone = isDeletedForEveryone(m);
    const hiddenForMe = !!authUser?.id && isMessageHiddenForViewer(m, authUser.id) && !deletedEveryone;
    const placeholder = deletedEveryone ? "everyone" : hiddenForMe ? "hidden" : null;
    const canEdit =
      m.sender_id === authUser?.id &&
      !placeholder &&
      !!m.message?.trim() &&
      canEditMessage(m, authUser?.id);
    const canDeleteForMe =
      !!authUser?.id && !hiddenForMe && !deletedEveryone && !String(m.id).startsWith("pending-");
    const canDeleteForEveryone =
      m.sender_id === authUser?.id &&
      !deletedEveryone &&
      !String(m.id).startsWith("pending-") &&
      !m.client_sending;
    const canCopyBody =
      !placeholder &&
      !!(
        m.message?.trim() ||
        m.image_url ||
        (m.media_url && !isVoiceMediaUrl(m.media_url))
      );
    return { canEdit, canDeleteForMe, canDeleteForEveryone, canCopyBody, placeholder };
  }, [mobileSheetMsg, authUser?.id]);

  const applySheetReaction = useCallback(
    async (emoji: string) => {
      if (!mobileSheetMsg || !conversation?.id || !authUser?.id || reactionApplyBusy) return;
      const msg = mobileSheetMsg;
      const myEmoji = reactionByMessage[msg.id]?.myEmoji ?? null;
      setReactionApplyBusy(true);
      try {
        if (myEmoji === emoji) {
          const { error } = await removeOwnMessageReaction(supabase, msg.id, authUser.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await setMessageReaction(supabase, {
            conversationId: conversation.id,
            messageId: msg.id,
            userId: authUser.id,
            emoji,
          });
          if (error) throw new Error(error.message);
        }
        await refreshReactions();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not update reaction");
      } finally {
        setReactionApplyBusy(false);
      }
    },
    [
      mobileSheetMsg,
      conversation?.id,
      authUser?.id,
      reactionApplyBusy,
      reactionByMessage,
      refreshReactions,
    ],
  );

  const runConfirm = useCallback(async () => {
    if (!pendingConfirm || actionBusy) return;
    setActionBusy(true);
    try {
      if (pendingConfirm.kind === "delete-for-me") {
        const target = pendingConfirm.message;
        if (!authUser?.id) return;
        const prevArr = target.deleted_for ?? [];
        if (prevArr.includes(authUser.id)) {
          setPendingConfirm(null);
          return;
        }
        const next = [...prevArr, authUser.id];
        const { error } = await supabase.from("chat_messages").update({ deleted_for: next }).eq("id", target.id);
        if (error) throw error;
        setMessages((prev) =>
          prev.map((m) => (m.id === target.id ? { ...m, deleted_for: next } : m)),
        );
        setReplyingTo((c) => (c?.id === target.id ? null : c));
        toast.success("Message removed for you");
      } else if (pendingConfirm.kind === "delete-for-everyone") {
        const target = pendingConfirm.message;
        const { error } = await supabase
          .from("chat_messages")
          .update({
            deleted_for_everyone: true,
            message: "",
            image_url: null,
            media_url: null,
            product_id: null,
          })
          .eq("id", target.id);
        if (error) throw error;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === target.id
              ? {
                  ...m,
                  deleted_for_everyone: true,
                  message: "",
                  image_url: null,
                  media_url: null,
                  product_id: null,
                }
              : m,
          ),
        );
        setReplyingTo((c) => (c?.id === target.id ? null : c));
        toast.success("Message deleted for everyone");
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
  }, [actionBusy, authUser?.id, conversation?.id, navigate, pendingConfirm]);

  const jumpToMessage = useCallback((id: string | null | undefined) => {
    if (!id) return;
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(id);
      window.setTimeout(() => setHighlightedMessageId(null), 2000);
    }
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
          <div className="px-2 py-2 sm:px-3">
            <div className="flex min-h-[52px] items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate("/messages")}
                className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/10"
                aria-label="Back"
              >
                <ArrowLeft className="h-6 w-6 text-gray-800 dark:text-zinc-100" />
              </button>
              <img
                src={peerAvatarDisplay}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-gray-200 object-cover ring-2 ring-white dark:ring-zinc-700"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <h1 className="min-w-0 truncate text-base font-bold leading-tight text-gray-900 dark:text-zinc-100">{peerName}</h1>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-white/10"
                    disabled={followBusy}
                    title={isFollowingPeer ? "Unfollow" : "Follow"}
                    aria-label={isFollowingPeer ? "Unfollow" : "Follow"}
                    onClick={() => void toggleFollowPeer()}
                  >
                    {isFollowingPeer ? (
                      <UserCheck className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
                    ) : (
                      <UserPlus className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
                    )}
                  </button>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      peerTyping ? "bg-amber-500" : peerActiveByProfile ? "bg-[#25D366]" : "bg-gray-400",
                    )}
                    aria-hidden
                  />
                  {peerTyping ? (
                    <span>typing…</span>
                  ) : peerActiveByProfile ? (
                    <span className="text-[#16a34a] dark:text-[#4ade80]">Online</span>
                  ) : peerLastActive ? (
                    <span className="truncate">Last seen {formatListTime(peerLastActive)}</span>
                  ) : (
                    <span>Offline</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/10"
                aria-label="Search in chat"
                onClick={() => setSearchOpen((v) => !v)}
              >
                <Search className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/10"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {peerMemberSince ? (
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Member since {peerMemberSince}
                    </DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/profile/${peerId}`} className="flex cursor-pointer items-center gap-2">
                      <User className="h-4 w-4" />
                      View profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setBulkSelectMode(true);
                      setSelectedMessageIds([]);
                    }}
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Select messages
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
                      navigate("/settings/blocked-users");
                      toast.message("Finish blocking from Settings.");
                    }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Block user
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
        <div
          className="max-md:shrink-0 md:hidden"
          style={{ minHeight: peerHeaderHeight, height: peerHeaderHeight }}
          aria-hidden
        />

        {bulkSelectMode ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#0a7a47] bg-[#0f9d58] px-3 py-2.5 text-white shadow-sm dark:border-emerald-950 dark:bg-[#0c7a45]">
            <button
              type="button"
              className="min-h-[44px] text-sm font-medium text-white/95 hover:underline"
              onClick={exitBulkSelectMode}
            >
              Cancel
            </button>
            <span className="text-sm font-semibold tabular-nums">{selectedMessageIds.length} selected</span>
            <button
              type="button"
              disabled={bulkDeleteBusy || selectedMessageIds.length === 0}
              className="min-h-[44px] text-sm font-bold text-white disabled:opacity-40"
              onClick={() => void deleteSelectedMessages()}
            >
              {bulkDeleteBusy ? "…" : "Delete"}
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
            className="chat-messages min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#e5ddd5] px-2 py-2 sm:px-3 [-webkit-overflow-scrolling:touch] dark:bg-zinc-950"
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
                const mine = msg.sender_id === authUser?.id;
                const t = new Date(msg.created_at);
                const timeLabel = Number.isNaN(t.getTime())
                  ? ""
                  : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const replyPreview = msg.reply_preview;
                const replyTarget = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : undefined;
                const quotedSender = replyPreview
                  ? senderLabel(replyPreview.sender_id)
                  : replyTarget
                    ? senderLabel(replyTarget.sender_id)
                    : "Message";
                const quotedPreviewText = replyTarget?.deleted_for_everyone
                  ? CHAT_MESSAGE_DELETED_PLACEHOLDER
                  : replyPreview
                    ? messagePreviewText(replyPreview.message, replyPreview.image_url)
                    : replyTarget
                      ? messagePreviewText(replyTarget.message, replyTarget.image_url)
                      : "Original message";
                const isHighlighted = highlightedMessageId === msg.id;
                const deletedEveryone = isDeletedForEveryone(msg);
                const hiddenForMe =
                  !!authUser?.id && isMessageHiddenForViewer(msg, authUser.id) && !deletedEveryone;
                const deletedPlaceholder = deletedEveryone ? "everyone" : hiddenForMe ? "hidden" : null;
                const productCard = deletedPlaceholder ? null : resolveMessageProductCard(msg);

                const actionsDisabled = String(msg.id).startsWith("pending-") || bulkSelectMode;
                const canEditThis =
                  mine &&
                  !deletedPlaceholder &&
                  !!msg.message?.trim() &&
                  canEditMessage(msg, authUser?.id);

                const messageBubbleEl = (
                  <MessageBubble
                    mine={mine}
                    timeLabel={timeLabel}
                    showMeta={showMeta}
                    receiptPhase={outgoingReceiptPhase(msg)}
                    showIncomingRead={!mine && !!msg.read_at}
                    isHighlighted={isHighlighted}
                    edited={!!msg.edited}
                    deletedPlaceholder={deletedPlaceholder}
                    showSenderName={false}
                    reactions={deletedPlaceholder ? null : reactionByMessage[msg.id]?.summaries ?? null}
                    onRequestActions={
                      actionsDisabled ? undefined : () => openMessageActions(msg)
                    }
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
                          <p className="line-clamp-2 text-[12px] leading-snug opacity-90">{quotedPreviewText}</p>
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
                          disableLink={false}
                        />
                      ) : null
                    }
                  >
                    <div className="space-y-2">
                      {msg.image_url ? (
                        <img
                          src={msg.image_url}
                          alt=""
                          className="max-h-64 max-w-full rounded-md object-cover"
                          loading="lazy"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      {msg.media_url && isVoiceMediaUrl(msg.media_url) ? (
                        <audio
                          src={msg.media_url}
                          controls
                          className="max-w-[min(100%,280px)]"
                          preload="metadata"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      {msg.media_url && !isVoiceMediaUrl(msg.media_url) ? (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm font-medium ${
                            mine
                              ? "border-white/30 bg-black/15 text-white hover:bg-black/25"
                              : "border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          }`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          Open file
                        </a>
                      ) : null}
                      {msg.message?.trim() ? (
                        <p
                          data-skip-longpress
                          className={`select-text whitespace-pre-wrap break-words text-sm leading-relaxed ${mine ? "text-white" : "text-inherit"}`}
                        >
                          {msg.message}
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
                  <div
                    className={cn("flex min-w-0 items-start gap-1.5", bulkSelectMode && mine && "touch-manipulation")}
                  >
                    {bulkSelectMode && mine ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selectedMessageIds.includes(msg.id)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMessageSelected(msg);
                        }}
                        className={cn(
                          "mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition",
                          selectedMessageIds.includes(msg.id)
                            ? "border-white bg-white text-[#0f9d58]"
                            : "border-zinc-500 bg-white/90 text-transparent dark:border-zinc-400 dark:bg-zinc-800",
                        )}
                      >
                        {selectedMessageIds.includes(msg.id) ? "✓" : null}
                      </button>
                    ) : null}
                    <div className="min-w-0 flex-1 touch-manipulation">{messageBubbleEl}</div>
                  </div>
                );

                const canCopyBody =
                  !deletedPlaceholder &&
                  !!(
                    msg.message?.trim() ||
                    msg.image_url ||
                    (msg.media_url && !isVoiceMediaUrl(msg.media_url))
                  );
                const canDeleteForMe =
                  !!authUser?.id && !hiddenForMe && !deletedEveryone && !String(msg.id).startsWith("pending-");
                const canDeleteForEveryone =
                  mine &&
                  !deletedEveryone &&
                  !String(msg.id).startsWith("pending-") &&
                  !msg.client_sending;

                const menuItems = (
                  <>
                    <ContextMenuItem
                      onSelect={() => {
                        setReplyingTo(msg);
                        jumpToMessage(msg.id);
                      }}
                    >
                      <Reply className="mr-2 h-4 w-4" />
                      Reply
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canCopyBody}
                      onSelect={() => {
                        if (!canCopyBody) return;
                        void copyText(msg);
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </ContextMenuItem>
                    {canEditThis ? (
                      <ContextMenuItem
                        onSelect={() => {
                          setReplyingTo(null);
                          setEditingMessage(msg);
                          setDraft(msg.message ?? "");
                          requestAnimationFrame(() => draftTextareaRef.current?.focus());
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </ContextMenuItem>
                    ) : null}
                    <ContextMenuItem onSelect={() => void forwardSingleMessage(msg)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Forward
                    </ContextMenuItem>
                    {(canDeleteForMe || canDeleteForEveryone) && <ContextMenuSeparator />}
                    {canDeleteForMe ? (
                      <ContextMenuItem
                        className="text-red-600"
                        onSelect={() => requestDeleteForMe(msg)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete for me
                      </ContextMenuItem>
                    ) : null}
                    {canDeleteForEveryone ? (
                      <ContextMenuItem
                        className="text-red-600"
                        onSelect={() => requestDeleteForEveryone(msg)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete for everyone
                      </ContextMenuItem>
                    ) : null}
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
                      {bulkSelectMode || !useDesktopContextMenu ? (
                        rowBody
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>{rowBody}</ContextMenuTrigger>
                          <ContextMenuContent className="min-w-[12rem]">{menuItems}</ContextMenuContent>
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

          <div className="relative z-30 shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-2 py-2 sm:px-3">
              {editingMessage ? (
                <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-amber-600/40 bg-amber-50/95 px-3 py-2.5 dark:border-amber-500/35 dark:bg-amber-950/55">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                      Editing message
                    </p>
                    <p className="truncate text-sm text-amber-950 dark:text-amber-50/95">
                      {messagePreviewText(editingMessage.message, editingMessage.image_url)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(null);
                      setDraft("");
                    }}
                    className="shrink-0 rounded-full p-1 text-amber-900 hover:bg-amber-800/10 dark:text-amber-200 dark:hover:bg-amber-900/50"
                    aria-label="Cancel edit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {replyingTo ? (
                <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-emerald-700/35 bg-emerald-700/15 px-3 py-2.5 dark:border-emerald-500/40 dark:bg-emerald-950/70">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
                      Replying to {senderLabel(replyingTo.sender_id)}
                    </p>
                    <p className="truncate text-sm text-emerald-950 dark:text-emerald-50/95">
                      {messagePreviewText(replyingTo.message, replyingTo.image_url)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 rounded-full p-1 text-emerald-900 hover:bg-emerald-800/15 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-end gap-0.5 sm:gap-1">
                <input ref={attachInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                <input
                  ref={docInputRef}
                  type="file"
                  accept={DOC_PICKER_ACCEPT}
                  className="hidden"
                  onChange={onPickDocument}
                />
                <button
                  type="button"
                  disabled={!!editingMessage}
                  onClick={() => attachInputRef.current?.click()}
                  className="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Attach image"
                >
                  <ImagePlus className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={!!editingMessage}
                  onClick={() => docInputRef.current?.click()}
                  className="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Attach PDF or Word"
                  title="PDF, Word…"
                >
                  <FileText className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={!!editingMessage || (!conversation?.context_product_id && !stripProduct)}
                  onClick={() => void sendProductCard()}
                  className="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Share listing"
                  title="Share product card"
                >
                  <Package className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} />
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
                    placeholder={editingMessage ? "Edit message…" : "Message…"}
                    className="max-h-[7.25rem] min-h-[44px] w-full resize-none overflow-y-auto rounded-2xl border border-[#bfc6c9] bg-white py-2.5 pl-3 pr-12 text-[15px] leading-relaxed outline-none focus:border-[#0f9d58] focus:ring-2 focus:ring-[#0f9d58]/25 dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
                  />
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        aria-label="Insert emoji"
                        title="Emoji"
                      >
                        <Smile className="h-[1.25rem] w-[1.25rem]" strokeWidth={2} />
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
                  disabled={!!editingMessage}
                  onPointerDown={onMicPointerDown}
                  className={`flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${recording ? "bg-red-500 text-white" : "text-gray-700 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"}`}
                  aria-label="Hold to record voice"
                  title="Hold to record"
                >
                  <Mic className="h-[1.35rem] w-[1.35rem]" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={sendBusy || !draft.trim()}
                  className="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-full bg-[#0f9d58] text-white shadow-sm disabled:opacity-50"
                  aria-label={editingMessage ? "Save edit" : "Send"}
                >
                  {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={mobileSheetMsg != null} onOpenChange={(open) => !open && setMobileSheetMsg(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[min(85dvh,32rem)] overflow-y-auto rounded-t-[1.35rem] border-zinc-200/80 bg-zinc-50 px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0 shadow-2xl dark:border-zinc-700/80 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-1 pt-3">
            <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-zinc-300/90 dark:bg-zinc-600" aria-hidden />
            {mobileSheetMsg ? (
              <>
                <div className="px-5 pb-2">
                  <SheetTitle className="text-left text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Message
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    React with emoji, reply, forward, copy, or delete this message.
                  </SheetDescription>
                  <p className="mt-1 line-clamp-3 text-sm leading-snug text-zinc-500 dark:text-zinc-400">
                    {mobileSheetMeta?.placeholder === "everyone"
                      ? CHAT_MESSAGE_DELETED_PLACEHOLDER
                      : mobileSheetMeta?.placeholder === "hidden"
                        ? CHAT_MESSAGE_DELETED_FOR_ME_PLACEHOLDER
                        : messagePreviewText(mobileSheetMsg.message, mobileSheetMsg.image_url) ||
                          (mobileSheetMsg.image_url
                            ? "Photo"
                            : mobileSheetMsg.media_url
                              ? isVoiceMediaUrl(mobileSheetMsg.media_url)
                                ? "Voice message"
                                : "File attachment"
                              : "Message")}
                  </p>
                </div>

                <div className="border-y border-zinc-200/90 bg-white/90 px-4 py-3 dark:border-zinc-700/90 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <Smile className="h-3.5 w-3.5" aria-hidden />
                    React
                  </div>
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {MESSAGE_SHEET_QUICK_REACTIONS.map((emoji) => {
                      const mine = reactionByMessage[mobileSheetMsg.id]?.myEmoji === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          disabled={reactionApplyBusy}
                          onClick={() => void applySheetReaction(emoji)}
                          title={mine ? "Remove reaction" : "Add reaction"}
                          className={cn(
                            "flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-2xl text-2xl transition active:scale-95 disabled:opacity-50",
                            mine
                              ? "bg-emerald-100 ring-2 ring-emerald-500/80 dark:bg-emerald-950/60 dark:ring-emerald-400/70"
                              : "bg-zinc-100 hover:bg-zinc-200/90 dark:bg-zinc-700/80 dark:hover:bg-zinc-600",
                          )}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">Tap again to remove your reaction.</p>
                </div>

                <div className="flex flex-col gap-2 px-4 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="h-11 rounded-xl font-medium shadow-sm"
                      onClick={() => {
                        setReplyingTo(mobileSheetMsg);
                        setMobileSheetMsg(null);
                      }}
                    >
                      <Reply className="mr-2 h-4 w-4" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border-zinc-200 bg-white font-medium dark:border-zinc-600 dark:bg-zinc-800"
                      onClick={() => void forwardSingleMessage(mobileSheetMsg)}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Forward
                    </Button>
                  </div>
                  {mobileSheetMeta?.canEdit ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full rounded-xl border-zinc-200 bg-white font-medium dark:border-zinc-600 dark:bg-zinc-800"
                      onClick={() => {
                        setReplyingTo(null);
                        setEditingMessage(mobileSheetMsg);
                        setDraft(mobileSheetMsg.message ?? "");
                        setMobileSheetMsg(null);
                        requestAnimationFrame(() => draftTextareaRef.current?.focus());
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      disabled={!mobileSheetMeta?.canCopyBody}
                      className={cn(
                        "h-11 rounded-xl border-zinc-200 bg-white font-medium dark:border-zinc-600 dark:bg-zinc-800",
                        !mobileSheetMeta?.canDeleteForMe && "col-span-2",
                      )}
                      onClick={() => void copyText(mobileSheetMsg)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    {mobileSheetMeta?.canDeleteForMe ? (
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-red-200 bg-white font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        onClick={() => requestDeleteForMe(mobileSheetMsg)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete for me
                      </Button>
                    ) : null}
                  </div>
                  {mobileSheetMeta?.canDeleteForEveryone ? (
                    <Button
                      variant="destructive"
                      className="h-11 w-full rounded-xl font-medium"
                      onClick={() => requestDeleteForEveryone(mobileSheetMsg)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete for everyone
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingConfirm != null} onOpenChange={(open) => !open && setPendingConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.kind === "delete-for-me"
                ? "Remove message for you?"
                : pendingConfirm?.kind === "delete-for-everyone"
                  ? "Delete for everyone?"
                  : pendingConfirm?.kind === "delete-conversation"
                    ? "Delete conversation?"
                    : "Clear chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.kind === "delete-for-me"
                ? "This message will be hidden on your device only. Others will still see it."
                : pendingConfirm?.kind === "delete-for-everyone"
                  ? "This removes the message for everyone in this chat."
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
              {actionBusy
                ? "…"
                : pendingConfirm?.kind === "delete-for-me"
                  ? "Remove"
                  : pendingConfirm?.kind === "delete-for-everyone"
                    ? "Delete for everyone"
                    : "Continue"}
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
