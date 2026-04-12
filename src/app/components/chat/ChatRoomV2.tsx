import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Paperclip, Pin, Send, Smile, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { useInboxConversationList } from "../../hooks/useInboxConversationList";
import { getAvatarUrl } from "../../utils/getAvatar";
import { getProductPrice } from "../../utils/getProductPrice";
import {
  clearConversationForMe,
  fetchPinnedMessage,
  fetchSavedMessageIds,
  toggleSavedMessage,
  unpinConversation,
  upsertPinnedMessage,
  type PinnedMessageRow,
} from "../../utils/chatMessageExtras";
import {
  fetchConversationById,
  otherPartyUserId,
  setConversationContextProduct,
  updateConversationLastRead,
  type ConversationRow,
} from "../../utils/chatConversations";
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
import { Button } from "../ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../ui/utils";
import { ChatPortraitProductCard } from "./ChatPortraitProductCard";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { MessageBubbleV2 } from "./MessageBubbleV2";
import { MessageMenuV2, MESSAGE_QUICK_REACTIONS } from "./MessageMenuV2";

const CHAT_MEDIA_BUCKETS = ["chat-media", "chat-images", "chat-attachments"] as const;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const PEER_ACTIVE_MS = 5 * 60 * 1000;

const INPUT_EMOJIS = ["😀", "😊", "👍", "❤️", "😂", "🙏", "😮", "😢", "🔥", "✨"];

function isMessageFromViewer(senderId: string | undefined, viewerId: string | undefined): boolean {
  if (!senderId || !viewerId) return false;
  return String(senderId).toLowerCase() === String(viewerId).toLowerCase();
}

function parseConversationInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseProductQueryParam(param: string | null): number | null {
  if (param == null || param === "") return null;
  const t = decodeURIComponent(String(param)).trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return null;
  const i = Math.trunc(n);
  return i >= 1 ? i : null;
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

/**
 * WhatsApp-style DM (v2). Routed at `/chat-v2/:id` for testing; production inbox still uses `ChatWorkspace`.
 */
export default function ChatRoomV2() {
  const { id: routeConversationId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const formatPrice = useCurrency();

  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [menuMsg, setMenuMsg] = useState<ChatMessageRow | null>(null);
  const [menuSelectedText, setMenuSelectedText] = useState("");
  const [useDesktopContextMenu, setUseDesktopContextMenu] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  const atBottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const attachInputRef = useRef<HTMLInputElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const threadMessagesRef = useRef<ChatMessageRow[]>([]);
  const refreshReactionsRef = useRef<() => Promise<void>>(async () => {});

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Member");
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [peerGender, setPeerGender] = useState<string | null>(null);
  const [peerLastActive, setPeerLastActive] = useState<string | null>(null);
  const [peerPresenceTick, setPeerPresenceTick] = useState(0);
  const [peerOnline, setPeerOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [stripProduct, setStripProduct] = useState<StripProduct | null>(null);
  const [listingStripLoading, setListingStripLoading] = useState(false);
  const [messageProductsById, setMessageProductsById] = useState<Map<number, StripProduct>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const sendLockRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reactionByMessage, setReactionByMessage] = useState<Record<string, MessageReactionsState>>({});
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isFollowingPeer, setIsFollowingPeer] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editTarget, setEditTarget] = useState<ChatMessageRow | null>(null);

  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<ChatMessageRow | null>(null);

  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(() => new Set());
  const [pinnedRow, setPinnedRow] = useState<PinnedMessageRow | null>(null);
  const [infoMsg, setInfoMsg] = useState<ChatMessageRow | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const peerHeaderRef = useRef<HTMLElement | null>(null);
  const [peerHeaderHeight, setPeerHeaderHeight] = useState(120);
  const attachListingToFirstSendRef = useRef(false);

  const { filtered: inboxFiltered, profiles: inboxProfiles, otherPartyUserId: inboxOtherPartyUserId, load: loadInbox } =
    useInboxConversationList(authUser?.id);

  const productParam = searchParams.get("product");
  const validProductId = useMemo(() => parseProductQueryParam(productParam), [productParam]);

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

  const statusLabel = useMemo(() => {
    if (peerOnline) return "online";
    if (peerActiveByProfile) return "Active now";
    if (peerLastActive) {
      const t = new Date(peerLastActive);
      if (!Number.isNaN(t.getTime())) return `Last seen ${t.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
    }
    return "";
  }, [peerOnline, peerActiveByProfile, peerLastActive]);

  const resolveMessageProductCard = useCallback(
    (msg: ChatMessageRow): { strip: StripProduct; pricePending: boolean } | null => {
      const pid = msg.product_id;
      if (pid == null) return null;
      const fromMap = messageProductsById.get(pid);
      if (fromMap) return { strip: fromMap, pricePending: false };
      if (stripProduct && stripProduct.id === pid) return { strip: stripProduct, pricePending: false };
      return {
        strip: { id: pid, title: "Listing", price: 0, image: null, like_count: 0, condition: null },
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
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = gap < 100;
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
      .channel(`pinned-msg-v2:${cid}`)
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
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setUseDesktopContextMenu(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onSel = () => {
      const t = (document.getSelection()?.toString() ?? "").trim();
      setMenuSelectedText(t);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

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
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [peerName, conversation?.id, stripProduct, listingStripLoading, statusLabel]);

  useLayoutEffect(() => {
    const lastLayoutInnerRef = { current: window.innerHeight };
    const vv = window.visualViewport;
    const apply = () => {
      const inner = window.innerHeight;
      const visibleH = vv?.height ?? inner;
      const typingInDraft = document.activeElement === draftTextareaRef.current;
      const likelyObscured =
        visibleH < inner * 0.88 || (typingInDraft && visibleH < lastLayoutInnerRef.current * 0.82);
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
    const threadIdParam = routeConversationId?.trim() ?? "";
    setLoading(true);
    setLoadError(null);
    attachListingToFirstSendRef.current = false;
    try {
      if (!threadIdParam || !isValidConversationUUID(threadIdParam)) {
        setLoadError("Invalid conversation link.");
        setConversation(null);
        setPeerId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await fetchConversationById(supabase, threadIdParam);
      if (error) throw new Error(error.message);
      if (!data) {
        setLoadError("Conversation not found.");
        setConversation(null);
        setPeerId(null);
        setLoading(false);
        return;
      }
      let conv = data;
      const peer = otherPartyUserId(conv, authUser.id);
      if (!peer) throw new Error("Not a participant");

      if (validProductId) {
        const current = parseConversationInt(conv.context_product_id);
        if (current !== validProductId) {
          const { error: uErr } = await setConversationContextProduct(supabase, conv.id, validProductId);
          if (!uErr) conv = { ...conv, context_product_id: validProductId };
        }
      }

      setConversation(conv);
      setPeerId(peer);
      setPeerLastActive(null);
      setPeerOnline(false);

      const profileSel = "full_name, avatar_url, gender, phone, state, lga, created_at, last_active";
      const pubRes = await supabase.from("profiles_public").select(profileSel).eq("id", peer).maybeSingle();

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
        const la = typeof prof.last_active === "string" ? prof.last_active : null;
        setPeerLastActive(la);
      } else {
        setPeerName("Member");
        setPeerAvatarUrl(null);
        setPeerGender(null);
      }

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
  }, [authUser?.id, routeConversationId, validProductId]);

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
    void loadInbox();
  }, [authLoading, authUser?.id, loadInbox]);

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
    };
  }, [stripProductSourceId]);

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
      .channel(`chat-v2-messages:${mid}`)
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
      .channel(`chat-v2-conv:${mid}`)
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
    let cancelled = false;
    void supabase
      .from("user_status")
      .select("is_online")
      .eq("user_id", peerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPeerOnline(!!data?.is_online);
      });
    const ch = supabase
      .channel(`chat-v2-peer-status:${peerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_status",
          filter: `user_id=eq.${peerId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as { is_online?: boolean } | undefined;
          if (row && "is_online" in row) setPeerOnline(!!row.is_online);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [peerId]);

  useEffect(() => {
    if (!peerId) return;
    const ch = supabase
      .channel(`chat-v2-peer-prof:${peerId}`)
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
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (opts?: { text?: string; imageFile?: File | null; productId?: number | null }) => {
      const text = (opts?.text ?? draft).trim();
      const imageFile = opts?.imageFile;

      if (!authUser?.id || !conversation) {
        toast.error("Chat is not ready.");
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

      if (!text && !imageFile && productId == null) {
        toast.message("Type a message or attach an image.");
        return;
      }
      if (sendLockRef.current) return;
      sendLockRef.current = true;
      setSendBusy(true);
      const replyToId = replyingTo?.id ?? null;
      let imageUrl: string | null = null;
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
            product_id: productId,
          })
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
        toast.error(errorMessage(e, "Message not sent"));
        setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("pending-")));
      } finally {
        sendLockRef.current = false;
        setSendBusy(false);
      }
    },
    [authUser?.id, conversation, draft, replyingTo, scrollToBottom],
  );

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
      setMenuMsg(null);
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

  const openMenu = useCallback((msg: ChatMessageRow) => {
    if (String(msg.id).startsWith("pending-")) return;
    const sel = (document.getSelection()?.toString() ?? "").trim();
    setMenuSelectedText(sel);
    setMenuMsg(msg);
  }, []);

  const jumpToMessage = useCallback((id: string | null | undefined) => {
    if (!id) return;
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(id);
      window.setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  const deleteForMe = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id) return;
      setMenuMsg(null);
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
        m.map((row) =>
          row.id === msg.id ? { ...row, deleted_for: [...prev, authUser.id] } : row,
        ),
      );
      toast.success("Removed from this chat");
    },
    [authUser?.id],
  );

  const deleteForEveryone = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id || !canDeleteMessageForEveryone(msg, authUser.id)) return;
      setMenuMsg(null);
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
    setMenuMsg(null);
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

  const forwardToConversation = useCallback(
    async (targetConversationId: string) => {
      if (!authUser?.id || !forwardTarget) return;
      const msg = forwardTarget;
      const parts = [msg.message?.trim() ?? "", msg.image_url ? "[Image]" : ""].filter(Boolean);
      const text = parts.join("\n");
      if (!text.trim() && !msg.image_url) {
        toast.message("Nothing to forward");
        return;
      }
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: targetConversationId,
        sender_id: authUser.id,
        message: text || (msg.image_url ? "Photo" : ""),
        image_url: msg.image_url ?? null,
        product_id: msg.product_id ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setForwardOpen(false);
      setForwardTarget(null);
      setMenuMsg(null);
      toast.success("Forwarded");
    },
    [authUser?.id, forwardTarget],
  );

  const openForwardPicker = useCallback((msg: ChatMessageRow) => {
    setMenuMsg(null);
    setForwardTarget(msg);
    setForwardOpen(true);
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

  const onReactFromMenu = useCallback(
    async (emoji: string) => {
      if (!conversation?.id || !authUser?.id || !menuMsg) return;
      const mid = menuMsg.id;
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
        setMenuMsg(null);
        await refreshReactions();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not react");
      }
    },
    [conversation?.id, authUser?.id, menuMsg, reactionByMessage, refreshReactions],
  );

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
      setMenuMsg(null);
      toast.message(starred ? "Removed from saved" : "Saved");
    },
    [authUser?.id, savedMessageIds],
  );

  const pinMsg = useCallback(
    async (msg: ChatMessageRow) => {
      if (!authUser?.id || !conversation?.id) return;
      setMenuMsg(null);
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
    setMenuMsg(null);
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

  const runClearChat = useCallback(async () => {
    if (!conversation?.id) return;
    setClearBusy(true);
    try {
      const { error } = await clearConversationForMe(supabase, conversation.id);
      if (error) throw new Error(error.message);
      const { data: msgs, error: mErr } = await fetchChatMessagesForConversation(supabase, conversation.id);
      if (mErr) throw new Error(mErr.message);
      setMessages(msgs);
      setReplyingTo(null);
      setPinnedRow(null);
      setClearChatOpen(false);
      toast.success("Chat cleared for you");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not clear chat");
    } finally {
      setClearBusy(false);
    }
  }, [conversation?.id]);

  const chatShellStyle = {
    ...(viewportHeight ? { ["--chat-viewport-height" as string]: `${viewportHeight}px` } : {}),
    ["--chat-header-height" as string]: `${peerHeaderHeight}px`,
  } as React.CSSProperties;

  const shellHeight =
    "max-md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] max-md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)]";

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

  const menuMine = menuMsg ? isMessageFromViewer(menuMsg.sender_id, authUser.id) : false;

  const pinnedPreviewText =
    pinnedRow != null
      ? (() => {
          const m = messages.find((x) => x.id === pinnedRow.message_id);
          return m ? messagePreviewText(m.message, m.image_url) : "Original message unavailable";
        })()
      : "";

  return (
    <div style={chatShellStyle} className={`flex ${shellHeight} min-h-0 flex-col bg-[#e5ddd5] dark:bg-zinc-950`}>
      <header
        ref={peerHeaderRef}
        className={cn(
          "shrink-0 border-b border-[#d1d7db] bg-[#f0f2f5] shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
          "max-md:fixed max-md:left-0 max-md:right-0 max-md:top-16 max-md:z-40",
          "md:sticky md:top-16 md:z-30",
        )}
      >
        <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link to="/messages" aria-label="Back">
              <ArrowLeft className="h-6 w-6" />
            </Link>
          </Button>
          <img src={peerAvatarDisplay} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900 dark:text-zinc-100">{peerName}</p>
            <p className="truncate text-xs text-gray-600 dark:text-zinc-400">
              {statusLabel || "\u00a0"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-gray-700 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
            aria-label="Clear all messages"
            title="Clear all messages"
            onClick={() => setClearChatOpen(true)}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={followBusy}
            onClick={() => void toggleFollowPeer()}
            className="shrink-0 gap-1"
          >
            {isFollowingPeer ? (
              <>
                <UserCheck className="h-4 w-4" /> Following
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Follow
              </>
            )}
          </Button>
        </div>

        {stripProductSourceId != null && listingStripLoading && !stripProduct ? (
          <div className="border-t border-[#d1d7db] px-3 py-2 dark:border-zinc-700" aria-busy>
            <div className="flex animate-pulse gap-3">
              <span className="h-14 w-14 shrink-0 rounded-lg bg-gray-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-40 rounded bg-gray-200 dark:bg-zinc-700" />
                <div className="h-3 w-24 rounded bg-gray-100 dark:bg-zinc-600" />
              </div>
            </div>
          </div>
        ) : stripProduct ? (
          <div className="border-t border-[#d1d7db] bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/80">
            <div className="flex flex-wrap items-center gap-3">
              <ChatPortraitProductCard
                productId={stripProduct.id}
                title={stripProduct.title}
                priceLabel={formatPrice(stripProduct.price)}
                imageUrl={stripProduct.image}
                badge={stripProduct.condition}
              />
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to={`/products/${stripProduct.id}`}>View product</Link>
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-500">
              Listing from <code className="rounded bg-gray-100 px-1 dark:bg-zinc-900">?product=</code> or conversation context
            </p>
          </div>
        ) : null}
      </header>

      <div
        className="max-md:shrink-0 md:hidden"
        style={{ minHeight: peerHeaderHeight, height: peerHeaderHeight }}
        aria-hidden
      />

      <div ref={scrollRef} onScroll={updateScrollState} className="chat-messages min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
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
            const actionsDisabled = String(msg.id).startsWith("pending-");
            const dfe = isDeletedForEveryone(msg);
            const hiddenBody = dfe || (authUser?.id && isMessageHiddenForViewer(msg, authUser.id));

            const bubble = (
              <MessageBubbleV2
                mine={mine}
                timeLabel={timeLabel}
                showMeta={showMeta}
                receiptPhase={outgoingReceiptPhase(msg)}
                showIncomingRead={!mine && !!msg.read_at}
                isHighlighted={isHighlighted}
                edited={!!msg.edited}
                deletedForEveryone={dfe}
                deletedForMeStub={false}
                reactions={reactionByMessage[msg.id]?.summaries ?? null}
                onRequestMenu={actionsDisabled || hiddenBody ? undefined : () => openMenu(msg)}
                menuDisabled={actionsDisabled || !!hiddenBody}
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
                          : "border-gray-400 bg-gray-200/80 text-gray-900 dark:bg-zinc-500/80 dark:text-zinc-100"
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
                    <div className={mine ? "mr-0 self-end" : "ml-0 self-start"}>
                      <ChatPortraitProductCard
                        productId={productCard.strip.id}
                        title={productCard.strip.title}
                        priceLabel={productCard.pricePending ? "…" : formatPrice(productCard.strip.price)}
                        imageUrl={productCard.strip.image}
                        disableLink={false}
                      />
                    </div>
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
                    />
                  ) : null}
                  {msg.message?.trim() && !dfe ? (
                    <p
                      className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${mine ? "text-white" : "text-inherit"}`}
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
              </MessageBubbleV2>
            );

            const rowBody = <div className="block w-full min-w-0 flex-1 touch-manipulation">{bubble}</div>;

            const ctxReactions = (
              <div className="flex flex-wrap gap-1 border-b border-gray-100 px-1 py-2 dark:border-zinc-800">
                {MESSAGE_QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      void (async () => {
                        if (!conversation?.id || !authUser?.id) return;
                        const cur = reactionByMessage[msg.id]?.myEmoji;
                        try {
                          if (cur === emoji) {
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
                          toast.error(e instanceof Error ? e.message : "Could not react");
                        }
                      })();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
                  {useDesktopContextMenu && !actionsDisabled && !hiddenBody ? (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>{rowBody}</ContextMenuTrigger>
                      <ContextMenuContent className="min-w-[14rem]">
                        {ctxReactions}
                        <ContextMenuItem
                          onSelect={() => {
                            setReplyingTo(msg);
                            jumpToMessage(msg.id);
                          }}
                        >
                          Reply
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => void copyText(msg)}>Copy</ContextMenuItem>
                        <ContextMenuItem
                          disabled={!menuSelectedText.trim()}
                          onSelect={() => void copyText(msg, menuSelectedText)}
                        >
                          Copy selected text
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => openForwardPicker(msg)}>Forward</ContextMenuItem>
                        {mine && canEditMessage(msg, authUser?.id) ? (
                          <ContextMenuItem onSelect={() => startEdit(msg)}>Edit</ContextMenuItem>
                        ) : null}
                        {mine ? <ContextMenuItem onSelect={() => void pinMsg(msg)}>Pin</ContextMenuItem> : null}
                        <ContextMenuItem onSelect={() => void toggleStarMsg(msg)}>
                          {savedMessageIds.has(msg.id) ? "Unstar message" : "Star message"}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => openInfo(msg)}>Info</ContextMenuItem>
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
                      </ContextMenuContent>
                    </ContextMenu>
                  ) : (
                    rowBody
                  )}
                </div>
              </Fragment>
            );
          })}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      <div className="shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-zinc-700 dark:bg-zinc-900">
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
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
            <input ref={attachInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            <button
              type="button"
              onClick={() => attachInputRef.current?.click()}
              className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
              aria-label="Attach"
            >
              <Paperclip className="h-6 w-6" />
            </button>
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Emoji"
                >
                  <Smile className="h-6 w-6" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-[min(100vw-2rem,20rem)] p-2">
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
                  {INPUT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-xl hover:bg-emerald-50 dark:hover:bg-zinc-800"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
              className="min-h-[44px] min-w-0 flex-1 resize-none rounded-full border border-[#d1d7db] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] dark:border-zinc-600 dark:bg-zinc-800 dark:text-foreground"
            />
            <button
              type="button"
              disabled={sendBusy}
              onClick={() => void sendMessage()}
              className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50"
              aria-label="Send"
            >
              {sendBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuMsg ? (
        <MessageMenuV2
          open={!!menuMsg}
          onOpenChange={(o) => {
            if (!o) setMenuMsg(null);
          }}
          selectedText={menuSelectedText}
          isMine={menuMine}
          onReply={() => {
            setReplyingTo(menuMsg);
            jumpToMessage(menuMsg.id);
            setMenuMsg(null);
          }}
          onCopy={() => void copyText(menuMsg)}
          onCopySelected={() => void copyText(menuMsg, menuSelectedText)}
          onForward={() => openForwardPicker(menuMsg)}
          onToggleStar={() => void toggleStarMsg(menuMsg)}
          isStarred={savedMessageIds.has(menuMsg.id)}
          onInfo={() => openInfo(menuMsg)}
          onEdit={menuMine && canEditMessage(menuMsg, authUser?.id) ? () => startEdit(menuMsg) : undefined}
          onPin={menuMine ? () => void pinMsg(menuMsg) : undefined}
          onDeleteForMe={() => void deleteForMe(menuMsg)}
          onDeleteForEveryone={
            menuMine && canDeleteMessageForEveryone(menuMsg, authUser?.id)
              ? () => void deleteForEveryone(menuMsg)
              : undefined
          }
          onReact={(emoji) => void onReactFromMenu(emoji)}
          showEdit={!!(menuMine && canEditMessage(menuMsg, authUser?.id))}
          showDeleteForEveryone={!!(menuMine && canDeleteMessageForEveryone(menuMsg, authUser?.id))}
          myReaction={reactionByMessage[menuMsg.id]?.myEmoji ?? null}
        />
      ) : null}

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

      <AlertDialog open={clearChatOpen} onOpenChange={setClearChatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all messages?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in this chat will be hidden only for you. {peerFirstName} will still see the full history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={clearBusy}
              onClick={(e) => {
                e.preventDefault();
                void runClearChat();
              }}
            >
              {clearBusy ? "…" : "Clear chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            {inboxFiltered
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
            {inboxFiltered.filter((row) => row.id !== conversation.id).length === 0 ? (
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
    </div>
  );
}
