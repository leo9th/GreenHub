import React, { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import {
  ArrowLeft,
  ArrowDown,
  Send,
  MoreVertical,
  Phone,
  Copy,
  MessageCircle,
  Reply,
  Search,
  Trash2,
  User,
  Ban,
  Eraser,
  Smile,
  Share2,
  Paperclip,
  FileText,
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
  clearConversationContextProduct,
  type ConversationRow,
} from "../utils/chatConversations";
import {
  fetchChatMessagesForConversation,
  markConversationMessagesDelivered,
  markConversationMessagesRead,
  normalizeChatMessageRow,
  outgoingReceiptPhase,
  resolveChatMessageReplyPreviews,
  type ChatMessageRow,
} from "../utils/chatMessages";
import { formatListTime, useInboxConversationList } from "../hooks/useInboxConversationList";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/context-menu";
import { MessageBubble } from "../components/chat/MessageBubble";
import { ChatPortraitProductCard } from "../components/chat/ChatPortraitProductCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
function ChatErrorBoundary({ children }: { children: React.ReactNode }) {
  class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
      // eslint-disable-next-line no-console
      console.error("Chat boundary caught:", error, info);
    }
    render() {
      if (this.state.error) {
        return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-inner">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Chat encountered a problem</h2>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              We couldn&apos;t render this conversation. Please reload or go back to your inbox.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
              >
                Reload
              </button>
              <Link
                to="/messages"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to messages
              </Link>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return <Boundary>{children}</Boundary>;
}

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

/** Conversation / user IDs in routes must be RFC-4122 UUIDs (trimmed). */
function isValidConversationUUID(id: string): boolean {
  const t = id.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

/** Migrations use `chat-attachments` (sql) or `chat-images` (image_url migration) — try both. */
const CHAT_STORAGE_BUCKETS = ["chat-attachments", "chat-images"] as const;

async function uploadChatAttachmentToStorage(
  path: string,
  file: File,
  opts: { cacheControl: string; upsert: boolean; contentType?: string | undefined },
): Promise<string> {
  let lastErr: Error | null = null;
  for (const bucket of CHAT_STORAGE_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, opts);
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
  throw lastErr ?? new Error("No chat storage bucket found. Create chat-attachments or chat-images in Supabase.");
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

function withinMinutes(isoA: string, isoB: string, mins: number): boolean {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) < mins * 60 * 1000;
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
  const sameDay = (x: Date, y: Date) =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const CHAT_ATTACH_MAX_BYTES = 25 * 1024 * 1024;
/** MIME types + extensions so mobile pickers offer JPG/PNG/WebP, PDF, DOC, DOCX. */
const CHAT_ATTACH_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
].join(",");

function formatChatAttachmentBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0).replace(/\.0$/, "")} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 0).replace(/\.0$/, "")} MB`;
}

function isChatImageMime(mime: string): boolean {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

/** Browsers often omit `file.type` on Windows; infer from extension. */
function inferChatAttachmentMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "";
}

/** Non-image file messages: caption, then meta line, then URL (last line). */
function formatChatDocMessage(caption: string, fileName: string, sizeBytes: number, publicUrl: string): string {
  const meta = `📎 ${fileName} · ${formatChatAttachmentBytes(sizeBytes)}`;
  const cap = caption.trim();
  if (cap) return `${cap}\n\n${meta}\n${publicUrl}`;
  return `${meta}\n${publicUrl}`;
}

function parseChatDocAttachment(msg: string): { caption: string; fileName?: string; url: string } | null {
  const lines = msg.split("\n");
  const metaIdx = lines.findIndex((l) => l.trimStart().startsWith("📎"));
  if (metaIdx === -1) return null;
  const urlLine = lines[metaIdx + 1]?.trim() ?? "";
  if (!/^https?:\/\//i.test(urlLine)) return null;
  const metaLine = lines[metaIdx].trim();
  const caption = lines.slice(0, metaIdx).join("\n").trim();
  const nameMatch = metaLine.match(/^📎\s+(.+?)\s·\s/);
  return { caption, fileName: nameMatch?.[1]?.trim(), url: urlLine };
}

function ChatMessageBubbleBody({ msg, mine }: { msg: ChatMessageRow; mine: boolean }) {
  const doc = !msg.image_url ? parseChatDocAttachment(msg.message) : null;
  const plainText = (msg.message ?? "").trim();

  if (msg.client_sending && !msg.image_url && !doc?.url && (msg.message ?? "").includes("📎")) {
    const lines = (msg.message ?? "").split("\n");
    const metaIdx = lines.findIndex((l) => l.trimStart().startsWith("📎"));
    const caption = metaIdx > 0 ? lines.slice(0, metaIdx).join("\n").trim() : "";
    const metaLine = metaIdx >= 0 ? lines[metaIdx].trim() : "";
    const nameMatch = metaLine.match(/^📎\s+(.+?)\s·\s/);
    return (
      <>
        {caption ? (
          <div className="mb-2 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{caption}</div>
        ) : null}
        <div
          className={`inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-[0.875rem] font-semibold ${
            mine ? "border border-white/30 bg-white/15 text-white" : "border border-emerald-200 bg-emerald-50/95 text-emerald-900"
          }`}
        >
          <FileText className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 truncate">{nameMatch?.[1]?.trim() ?? "Attachment"}</span>
          <span className="shrink-0 text-xs font-normal opacity-80">Sending…</span>
        </div>
      </>
    );
  }

  if (msg.image_url) {
    return (
      <>
        <a
          href={msg.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mb-1 block max-h-64 overflow-hidden rounded-lg ${mine ? "ring-1 ring-white/35" : "ring-1 ring-black/10"}`}
        >
          <img src={msg.image_url} alt="" className="max-h-64 w-full object-cover" loading="lazy" />
        </a>
        {plainText ? (
          <div className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{msg.message}</div>
        ) : null}
      </>
    );
  }

  if (doc?.url) {
    return (
      <>
        {doc.caption ? (
          <div className="mb-2 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{doc.caption}</div>
        ) : null}
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-[0.875rem] font-semibold ${
            mine ? "border border-white/30 bg-white/15 text-white" : "border border-emerald-200 bg-emerald-50/95 text-emerald-900"
          }`}
        >
          <FileText className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 truncate">{doc.fileName ?? "Open attachment"}</span>
        </a>
      </>
    );
  }

  if (plainText) {
    return <div className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{msg.message}</div>;
  }
  return null;
}

function messagePreviewText(message: string, imageUrl?: string | null): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized) return normalized;
  if (imageUrl) return "Photo";
  const doc = parseChatDocAttachment(message);
  if (doc?.url) return doc.fileName ? `📎 ${doc.fileName}` : "Attachment";
  return "Message";
}

const MOBILE_REPLY_HOLD_MS = 420;
const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
type ExternalChannel = "voice" | "whatsapp";

type StripProduct = {
  id: number;
  title: string;
  price: number;
  image: string | null;
  like_count: number;
};

type PendingConfirmAction =
  | { kind: "delete-message"; message: ChatMessageRow }
  | { kind: "delete-conversation" }
  | { kind: "clear-chat" }
  | null;

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M19.05 4.94A9.9 9.9 0 0 0 12 2a9.96 9.96 0 0 0-8.61 14.96L2 22l5.2-1.36A10 10 0 1 0 19.05 4.94ZM12 20.15a8.14 8.14 0 0 1-4.15-1.13l-.3-.18-3.09.81.83-3.01-.2-.31A8.13 8.13 0 1 1 12 20.15Zm4.46-6.1c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.77-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.36.51.57.18 1.09.16 1.5.1.46-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

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
  const [newMessage, setNewMessage] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [mobileActionMessage, setMobileActionMessage] = useState<ChatMessageRow | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [pendingNewMessages, setPendingNewMessages] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [activeSwipe, setActiveSwipe] = useState<{ messageId: string; offset: number } | null>(null);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const composerRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl?: string;
  } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [selfAvatarUrl, setSelfAvatarUrl] = useState("");
  const peerTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ messageId: string; x: number; y: number } | null>(null);
  const feedStateRef = useRef<{ count: number; lastMessageId: string | null; peerTyping: boolean }>({
    count: 0,
    lastMessageId: null,
    peerTyping: false,
  });

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Member");
  const [peerAvatar, setPeerAvatar] = useState<string>("");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [stripProduct, setStripProduct] = useState<StripProduct | null>(null);
  /** Listing rows for messages that include `product_id` (portrait cards in thread). */
  const [messageProductsById, setMessageProductsById] = useState<Map<number, StripProduct>>(() => new Map());
  const [contextClearBusy, setContextClearBusy] = useState(false);
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

  const setMessageNode = useCallback((messageId: string, node: HTMLDivElement | null) => {
    if (node) messageRefs.current.set(messageId, node);
    else messageRefs.current.delete(messageId);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = messagesScrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setShowScrollToLatest(false);
      setPendingNewMessages(0);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setIsNearBottom(true);
    setShowScrollToLatest(false);
    setPendingNewMessages(0);
  }, []);

  const scrollToMessageNode = useCallback(
    (messageId: string | null, options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition }) => {
      if (!messageId) return false;
      const node = messageRefs.current.get(messageId);
      if (!node) return false;
      node.scrollIntoView({
        behavior: options?.behavior ?? "smooth",
        block: options?.block ?? "center",
      });
      return true;
    },
    [],
  );

  const focusComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => {
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* noop */
      }
    });
  }, []);

  const senderLabel = useCallback(
    (senderId: string) => {
      if (senderId === authUser?.id) return "You";
      if (senderId === peerId) return peerFirstName;
      return "Member";
    },
    [authUser?.id, peerId, peerFirstName],
  );

  const selectReply = useCallback(
    (msg: ChatMessageRow) => {
      setReplyingTo(msg);
      setMobileActionMessage(null);
      focusComposer();
    },
    [focusComposer],
  );

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setMobileActionMessage(null);
  }, []);

  const clearPendingLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleMessagePointerDown = useCallback(
    (msg: ChatMessageRow, pointerType: string | undefined) => {
      if (pointerType !== "touch" && pointerType !== "pen") return;
      clearPendingLongPress();
      longPressTimerRef.current = setTimeout(() => {
        setMobileActionMessage(msg);
      }, MOBILE_REPLY_HOLD_MS);
    },
    [clearPendingLongPress],
  );

  const openMobileReplyActions = useCallback(
    (msg: ChatMessageRow) => {
      clearPendingLongPress();
      setMobileActionMessage(msg);
    },
    [clearPendingLongPress],
  );

  const jumpToMessage = useCallback(
    (messageId: string | null) => {
      if (!messageId) return;
      const didScroll = scrollToMessageNode(messageId, { block: "center" });
      if (!didScroll) {
        toast.message("Original message is not visible in this chat yet.");
        return;
      }
      setHighlightedMessageId(messageId);
      setShowScrollToLatest(true);
      setPendingNewMessages(0);
      if (highlightClearRef.current) clearTimeout(highlightClearRef.current);
      highlightClearRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === messageId ? null : current));
      }, 1800);
    },
    [scrollToMessageNode],
  );

  const highlightMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    if (highlightClearRef.current) clearTimeout(highlightClearRef.current);
    highlightClearRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 1800);
  }, []);

  useEffect(() => {
    const prev = feedStateRef.current;
    const lastMessage = messages[messages.length - 1] ?? null;
    const lastMessageId = lastMessage?.id ?? null;
    const hasNewMessage = lastMessageId !== prev.lastMessageId || messages.length !== prev.count;
    const typingStarted = peerTyping && !prev.peerTyping;
    const newestIsMine = lastMessage?.sender_id === authUser?.id;

    if (hasNewMessage) {
      if (newestIsMine || isNearBottom) scrollToBottom(prev.count === 0 ? "auto" : "smooth");
      else {
        setShowScrollToLatest(true);
        setPendingNewMessages((count) => count + 1);
      }
    } else if (typingStarted && isNearBottom) {
      scrollToBottom("smooth");
    }

    feedStateRef.current = { count: messages.length, lastMessageId, peerTyping };
  }, [authUser?.id, isNearBottom, messages, peerTyping, scrollToBottom]);

  /** Keeps the thread pinned to latest after any message list change (debug / send UX). */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    updateScrollState();
  }, [messages.length, peerTyping, updateScrollState]);

  useEffect(() => {
    return () => {
      clearPendingLongPress();
      if (highlightClearRef.current) clearTimeout(highlightClearRef.current);
    };
  }, [clearPendingLongPress]);

  useEffect(() => {
    let lastRounded: number | null = null;
    const updateViewportHeight = () => {
      const next = Math.round(window.visualViewport?.height ?? window.innerHeight);
      if (lastRounded !== null && Math.abs(next - lastRounded) < 2) return;
      lastRounded = next;
      setViewportHeight(next);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (!replyingTo) return;
    const next = messages.find((msg) => msg.id === replyingTo.id);
    if (!next) {
      setReplyingTo(null);
      return;
    }
    if (
      next.message !== replyingTo.message ||
      next.created_at !== replyingTo.created_at ||
      next.sender_id !== replyingTo.sender_id
    ) {
      setReplyingTo(next);
    }
  }, [messages, replyingTo]);

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

    if (threadId && !isValidConversationUUID(threadId)) {
      // eslint-disable-next-line no-console
      console.error("Invalid conversation ID:", threadId);
      setLoadError("Invalid conversation ID");
      setConversation(null);
      setPeerId(null);
      setLoading(false);
      return;
    }

    if (peerFromUrl && !isValidConversationUUID(peerFromUrl)) {
      // eslint-disable-next-line no-console
      console.error("Invalid peer user ID:", peerFromUrl);
      setLoadError(
        "This user cannot be messaged from this link because the account ID is invalid. Open their profile or listing again and try Chat once more.",
      );
      setConversation(null);
      setPeerId(null);
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
      setReplyingTo(null);
      setHighlightedMessageId(null);
      setMobileActionMessage(null);
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
    if (!authUser?.id) {
      setSelfAvatarUrl("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("avatar_url, gender, full_name")
        .eq("id", authUser.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setSelfAvatarUrl(getAvatarUrl(null, null, "You"));
        return;
      }
      const r = data as { avatar_url: string | null; gender: string | null; full_name: string | null };
      const nm = (r.full_name || "You").trim() || "You";
      setSelfAvatarUrl(getAvatarUrl(r.avatar_url, r.gender, nm));
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

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
        if (readErr.error) console.warn("markConversationMessagesRead:", readErr.error.message);
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
        if (error) console.warn("markConversationMessagesDelivered:", error.message);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [conversation?.id, authUser?.id, messages.length]);

  useEffect(() => {
    if (!conversation?.id) return;
    const mid = conversation.id;

    const msgChannel = supabase
      .channel(`chat-messages:${mid}`)
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
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : resolveChatMessageReplyPreviews([...prev, row]),
          );
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

  useEffect(() => {
    if (!newMessage.trim()) return;
    const t = window.setTimeout(() => {
      broadcastTyping();
    }, 600);
    return () => clearTimeout(t);
  }, [newMessage, broadcastTyping]);

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (attachInputRef.current) attachInputRef.current.value = "";
  }, []);

  const onAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > CHAT_ATTACH_MAX_BYTES) {
      toast.error(`File is too large (max ${formatChatAttachmentBytes(CHAT_ATTACH_MAX_BYTES)}).`);
      e.target.value = "";
      return;
    }
    const allowed = CHAT_ATTACH_ACCEPT.split(",").map((s) => s.trim());
    const effectiveMime = file.type || inferChatAttachmentMime(file.name);
    if (!effectiveMime || !allowed.includes(effectiveMime)) {
      toast.error("Use JPG, PNG, WebP, PDF, DOC, or DOCX.");
      e.target.value = "";
      return;
    }
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      const previewUrl = isChatImageMime(effectiveMime) ? URL.createObjectURL(file) : undefined;
      return { file, previewUrl };
    });
    e.target.value = "";
  };

  const sendMessage = async () => {
    // eslint-disable-next-line no-console
    console.log("[Chat] sendMessage called", {
      newMessagePreview: newMessage.slice(0, 120),
      newMessageLen: newMessage.length,
      conversationId: conversation?.id ?? null,
      hasAuth: !!authUser?.id,
      hasConversation: !!conversation,
      sendBusy,
      hasPendingFile: !!pendingAttachment?.file,
    });

    if (sendBusy) {
      // eslint-disable-next-line no-console
      console.log("[Chat] sendMessage exit: sendBusy");
      return;
    }
    const text = newMessage.trim();
    const file = pendingAttachment?.file;
    if (!text && !file) {
      // eslint-disable-next-line no-console
      console.log("[Chat] sendMessage exit: empty message and no attachment");
      return;
    }
    if (!authUser?.id) {
      // eslint-disable-next-line no-console
      console.warn("[Chat] sendMessage exit: not signed in");
      toast.error("Sign in to send messages.");
      return;
    }
    if (!conversation) {
      // eslint-disable-next-line no-console
      console.warn("[Chat] sendMessage exit: no conversation row");
      toast.error("Chat is not ready. Refresh the page and try again.");
      return;
    }

    const replyPreview =
      replyingTo == null
        ? null
        : {
            id: replyingTo.id,
            sender_id: replyingTo.sender_id,
            message: replyingTo.message,
            image_url: replyingTo.image_url ?? null,
          };

    const tempId = `pending-${crypto.randomUUID()}`;

    let optimisticMsg = text;
    let optimisticImg: string | null = null;
    if (file) {
      const mime = file.type || inferChatAttachmentMime(file.name);
      if (isChatImageMime(mime)) {
        optimisticImg = pendingAttachment?.previewUrl ?? null;
      } else {
        optimisticMsg = text
          ? `${text}\n\n📎 ${file.name} · ${formatChatAttachmentBytes(file.size)}`
          : `📎 ${file.name} · ${formatChatAttachmentBytes(file.size)}`;
      }
    }

    const optimistic: ChatMessageRow = {
      id: tempId,
      sender_id: authUser.id,
      message: optimisticMsg,
      created_at: new Date().toISOString(),
      status: "sent",
      delivered_at: null,
      read_at: null,
      reply_to_id: replyingTo?.id ?? null,
      reply_preview: replyPreview,
      image_url: optimisticImg,
      product_id: stripProduct?.id ?? null,
      client_sending: true,
    };
    setMessages((prev) => resolveChatMessageReplyPreviews([...prev, optimistic]));

    setSendBusy(true);
    try {
      let outgoingMessage = text;
      let outgoingImageUrl: string | null = null;

      if (file) {
        const mime = file.type || inferChatAttachmentMime(file.name);
        const ext = file.name.split(".").pop()?.replace(/[^\w.-]/g, "") || "bin";
        const safeExt = ext.length > 16 ? ext.slice(0, 16) : ext;
        const path = `${authUser.id}/${conversation.id}/${crypto.randomUUID()}.${safeExt}`;
        const publicUrl = await uploadChatAttachmentToStorage(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: mime || undefined,
        });

        if (isChatImageMime(mime)) {
          outgoingImageUrl = publicUrl;
          outgoingMessage = text;
        } else {
          outgoingMessage = formatChatDocMessage(text, file.name, file.size, publicUrl);
          outgoingImageUrl = null;
        }
      }

      const baseRow = {
        conversation_id: conversation.id,
        sender_id: authUser.id,
        message: outgoingMessage || (outgoingImageUrl ? "" : ""),
        image_url: outgoingImageUrl,
        reply_to_id: replyingTo?.id ?? null,
      };
      const withProduct =
        stripProduct?.id != null ? { ...baseRow, product_id: stripProduct.id } : baseRow;

      let { data: inserted, error } = await supabase.from("chat_messages").insert(withProduct).select("*").single();

      if (error && stripProduct?.id != null) {
        const em = (error.message ?? "").toLowerCase();
        if (em.includes("product_id") || em.includes("schema cache")) {
          const retry = await supabase.from("chat_messages").insert(baseRow).select("*").single();
          inserted = retry.data;
          error = retry.error;
        }
      }

      // eslint-disable-next-line no-console
      console.log("[Chat] chat_messages insert", {
        ok: !error,
        error: error?.message ?? null,
        code: error?.code ?? null,
        insertedId: inserted && typeof inserted === "object" && "id" in inserted ? (inserted as { id: string }).id : null,
      });

      if (error) throw error;
      if (inserted) {
        const row = normalizeChatMessageRow({
          ...(inserted as Record<string, unknown>),
          reply_preview: replyPreview,
        });
        setMessages((prev) => {
          const withoutPending = prev.filter((m) => m.id !== tempId);
          if (withoutPending.some((m) => m.id === row.id)) {
            return resolveChatMessageReplyPreviews(
              withoutPending.map((m) => (m.id === row.id ? { ...row, client_sending: false } : m)),
            );
          }
          return resolveChatMessageReplyPreviews([...withoutPending, { ...row, client_sending: false }]);
        });
      }
      setNewMessage("");
      clearPendingAttachment();
      cancelReply();
      scrollToBottom("smooth");
    } catch (e: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(errorMessage(e, "Message not sent"));
    } finally {
      setSendBusy(false);
    }
  };

  const removeProductContext = useCallback(async () => {
    if (!conversation || contextClearBusy) return;
    setContextClearBusy(true);
    try {
      const { error } = await clearConversationContextProduct(supabase, conversation.id);
      if (error) throw new Error(error.message);
      setConversation((c) => (c ? { ...c, context_product_id: null } : c));
      setStripProduct(null);
      toast.success("Listing removed from this chat");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Could not clear listing"));
    } finally {
      setContextClearBusy(false);
    }
  }, [conversation, contextClearBusy]);

  const openExternalChannel = useCallback(
    (channel: ExternalChannel) => {
      const links = phoneLinkTargets(peerPhone);
      if (!links) return;
      if (channel === "voice") {
        toast.message("Voice calls open outside GreenHub. Call details will not appear in this chat.");
        window.location.href = links.telHref;
        return;
      }
      toast.message("WhatsApp opens outside GreenHub. Messages there will not sync back into this chat.");
      window.open(links.waHref, "_blank", "noopener,noreferrer");
    },
    [peerPhone],
  );

  const insertEmoji = useCallback((emoji: string) => {
    const el = composerRef.current;
    if (!el) {
      setNewMessage((m) => m + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setNewMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* noop */
      }
    });
  }, []);

  const closeMobileActions = useCallback(() => {
    setMobileActionMessage(null);
  }, []);

  const copyMessageText = useCallback(async (msg: ChatMessageRow) => {
    try {
      await navigator.clipboard.writeText(msg.message);
      toast.success("Message copied");
      closeMobileActions();
    } catch {
      toast.error("Could not copy message");
    }
  }, [closeMobileActions]);

  const forwardMessage = useCallback(async (msg: ChatMessageRow) => {
    try {
      if (navigator.share) {
        await navigator.share({ text: msg.message });
        toast.success("Message ready to forward");
      } else {
        await navigator.clipboard.writeText(msg.message);
        toast.success("Message copied for forwarding");
      }
      closeMobileActions();
    } catch {
      toast.error("Could not forward message");
    }
  }, [closeMobileActions]);

  const applyMessageReaction = useCallback((messageId: string, emoji: string) => {
    setMessageReactions((prev) => ({ ...prev, [messageId]: emoji }));
  }, []);

  const promptDeleteMessage = useCallback((msg: ChatMessageRow) => {
    closeMobileActions();
    setPendingConfirmAction({ kind: "delete-message", message: msg });
  }, [closeMobileActions]);

  const promptDeleteConversation = useCallback(() => {
    setPendingConfirmAction({ kind: "delete-conversation" });
  }, []);

  const promptClearChat = useCallback(() => {
    setPendingConfirmAction({ kind: "clear-chat" });
  }, []);

  const handleBlockUser = useCallback(() => {
    navigate("/settings/blocked-users");
    toast.message("Finish blocking this account from Settings.");
  }, [navigate]);

  const runPendingConfirmAction = useCallback(async () => {
    if (!pendingConfirmAction || actionBusy) return;

    setActionBusy(true);
    try {
      if (pendingConfirmAction.kind === "delete-message") {
        const target = pendingConfirmAction.message;
        const { error } = await supabase.from("chat_messages").delete().eq("id", target.id);
        if (error) throw error;
        setMessages((prev) => prev.filter((msg) => msg.id !== target.id));
        setReplyingTo((current) => (current?.id === target.id ? null : current));
        setHighlightedMessageId((current) => (current === target.id ? null : current));
        toast.success("Message deleted");
      } else if (pendingConfirmAction.kind === "delete-conversation") {
        const cid = conversation?.id;
        if (!cid) {
          toast.error("Conversation is not ready yet.");
          return;
        }
        const { error } = await supabase.from("conversations").delete().eq("id", cid);
        if (error) throw error;
        toast.success("Conversation deleted");
        navigate("/messages", { replace: true });
        return;
      } else if (pendingConfirmAction.kind === "clear-chat") {
        const cid = conversation?.id;
        if (!cid) {
          toast.error("Conversation is not ready yet.");
          return;
        }
        if (messages.length === 0) {
          toast.message("Chat is already empty");
        } else {
          const { error } = await supabase.from("chat_messages").delete().eq("conversation_id", cid);
          if (error) {
            toast.message("Bulk clear is not available in this project yet.");
          } else {
            setMessages([]);
            setReplyingTo(null);
            setHighlightedMessageId(null);
            toast.success("Chat cleared");
          }
        }
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Action failed"));
    } finally {
      setActionBusy(false);
      setPendingConfirmAction(null);
    }
  }, [actionBusy, conversation?.id, messages.length, navigate, pendingConfirmAction]);

  const startSwipe = useCallback(
    (msg: ChatMessageRow, pointerType: string | undefined, clientX: number, clientY: number) => {
      if (pointerType !== "touch" && pointerType !== "pen") return;
      swipeStartRef.current = { messageId: msg.id, x: clientX, y: clientY };
      setActiveSwipe(null);
    },
    [],
  );

  const moveSwipe = useCallback(
    (msg: ChatMessageRow, pointerType: string | undefined, clientX: number, clientY: number) => {
      if (pointerType !== "touch" && pointerType !== "pen") return;
      const start = swipeStartRef.current;
      if (!start || start.messageId !== msg.id) return;
      const deltaX = clientX - start.x;
      const deltaY = clientY - start.y;
      if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
        setActiveSwipe(null);
        return;
      }
      if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
        clearPendingLongPress();
        setActiveSwipe({ messageId: msg.id, offset: Math.min(deltaX, 72) });
      } else if (activeSwipe?.messageId === msg.id) {
        setActiveSwipe(null);
      }
    },
    [activeSwipe?.messageId, clearPendingLongPress],
  );

  const finishSwipe = useCallback(
    (msg: ChatMessageRow) => {
      clearPendingLongPress();
      const offset = activeSwipe?.messageId === msg.id ? activeSwipe.offset : 0;
      swipeStartRef.current = null;
      setActiveSwipe(null);
      if (offset >= 54) {
        selectReply(msg);
        highlightMessage(msg.id);
      }
    },
    [activeSwipe, clearPendingLongPress, highlightMessage, selectReply],
  );

  const cancelSwipe = useCallback(() => {
    swipeStartRef.current = null;
    setActiveSwipe(null);
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 text-center pb-8">
        <p className="text-gray-800 font-medium mb-2">Please sign in to view this chat.</p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-medium"
        >
          Go to login
        </button>
      </div>
    );
  }

  if (!conversation || !peerId) {
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
  const chatViewportStyle = viewportHeight
    ? ({ ["--chat-viewport-height" as string]: `${viewportHeight}px` } as { [key: string]: string })
    : undefined;
  const chatShellStyle = {
    ...chatViewportStyle,
    ["--chat-header-height" as string]: "72px",
  } as { [key: string]: string };

  const chatPanel = (
    <>
      <div className="chat-pane relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-[#eefbf4] to-lime-50">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          <div className="absolute -left-14 top-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-lime-200/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.12),transparent_30%)]" />
        </div>
        <header className="chat-header-fixed z-40 shrink-0 border-b border-emerald-100/80 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/88">
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
                <p className="mt-0.5 truncate text-xs text-gray-500">Always-on chat</p>
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`rounded-lg p-2 text-gray-600 hover:bg-gray-100 ${peerContactLinks ? "" : "opacity-60"}`}
                    aria-label={
                      peerContactLinks
                        ? `Call or WhatsApp ${peerName}`
                        : `Contact — ${peerName} (no phone on profile)`
                    }
                    title={peerContactLinks ? "Call or WhatsApp" : "View contact options"}
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="font-semibold text-gray-900">{peerName}</DropdownMenuLabel>
                  {peerContactLinks ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex cursor-pointer items-start gap-2 py-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          openExternalChannel("whatsapp");
                        }}
                      >
                        <WhatsAppIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-[#25D366]">WhatsApp</span>
                          {peerPhone?.trim() ? (
                            <span className="mt-0.5 block truncate text-xs text-gray-500">{peerPhone.trim()}</span>
                          ) : null}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex cursor-pointer items-start gap-2 py-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          openExternalChannel("voice");
                        }}
                      >
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-gray-800">Call</span>
                          {peerPhone?.trim() ? (
                            <span className="mt-0.5 block truncate text-xs text-gray-500">{peerPhone.trim()}</span>
                          ) : null}
                        </span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled className="text-xs text-gray-500">
                        No phone number on profile
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu modal={false}>
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
                  <DropdownMenuLabel>Chat options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      promptDeleteConversation();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete conversation
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleBlockUser();
                    }}
                  >
                    <Ban className="h-4 w-4" />
                    Block user
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      promptClearChat();
                    }}
                  >
                    <Eraser className="h-4 w-4" />
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
          </div>
        </header>

        {stripProduct ? (
          <div className="relative z-20 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:px-4">
            <Link
              to={`/products/${stripProduct.id}`}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5"
              aria-label={`Open listing: ${stripProduct.title}`}
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
                className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-emerald-700"
              >
                {stripProduct.title}
              </Link>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatPrice(stripProduct.price)}</p>
            </div>
            <button
              type="button"
              onClick={() => void removeProductContext()}
              disabled={contextClearBusy}
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              title="Remove listing from this chat"
              aria-label="Remove listing from chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {showScrollToLatest ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
              <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollToBottom("smooth")}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-700 shadow-lg backdrop-blur hover:bg-white"
                >
                  <ArrowDown className="h-4 w-4" />
                  {pendingNewMessages > 0 ? `${pendingNewMessages} new ${pendingNewMessages === 1 ? "message" : "messages"}` : "Latest messages"}
                </button>
              </div>
            </div>
          ) : null}
          <div
            ref={messagesScrollerRef}
            onScroll={updateScrollState}
            className="chat-messages min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth px-3 py-3 sm:px-4 sm:py-4 [-webkit-overflow-scrolling:touch]"
          >
            <div className="flex flex-col pb-1">
              {messages.map((msg, i) => {
                const messageId = msg.id ?? `msg-${i}-${msg.created_at}`;
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
                const quotedSender = replyPreview ? senderLabel(replyPreview.sender_id) : "Original message";
                const isHighlighted = highlightedMessageId === msg.id;
                const swipeOffset = activeSwipe?.messageId === msg.id ? activeSwipe.offset : 0;
                return (
                  <Fragment key={messageId}>
                    {showDayDivider ? (
                      <div className="mb-3 flex justify-center">
                        <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold tracking-wide text-gray-600 shadow-sm ring-1 ring-black/5 backdrop-blur">
                          {dayDividerLabel(msg.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      ref={(node) => setMessageNode(messageId, node)}
                      className={`scroll-mt-24 w-full ${sameCluster ? "mb-0.5" : "mb-2"}`}
                    >
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            className="group relative touch-manipulation select-none [touch-action:pan-y] [-webkit-touch-callout:none] [-webkit-user-select:none]"
                            onPointerDown={(e) => {
                              handleMessagePointerDown(msg, e.pointerType);
                              startSwipe(msg, e.pointerType, e.clientX, e.clientY);
                            }}
                            onPointerUp={() => finishSwipe(msg)}
                            onPointerMove={(e) => moveSwipe(msg, e.pointerType, e.clientX, e.clientY)}
                            onPointerLeave={() => {
                              clearPendingLongPress();
                              cancelSwipe();
                            }}
                            onPointerCancel={() => {
                              clearPendingLongPress();
                              cancelSwipe();
                            }}
                            onContextMenu={(e) => {
                              if (window.matchMedia("(pointer: coarse)").matches) {
                                e.preventDefault();
                                openMobileReplyActions(msg);
                              }
                            }}
                          >
                            <div className="pointer-events-none absolute inset-y-0 left-2 z-[5] flex items-center">
                              <div
                                className={`rounded-full bg-emerald-100 p-2 text-emerald-700 transition ${
                                  swipeOffset > 16 ? "scale-100 opacity-100" : "scale-75 opacity-0"
                                }`}
                              >
                                <Reply className="h-4 w-4" />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => selectReply(msg)}
                              className={`absolute top-2 z-10 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:flex ${
                                mine
                                  ? "left-0 -translate-x-[calc(100%+0.35rem)] opacity-0 group-hover:opacity-100"
                                  : "right-0 translate-x-[calc(100%+0.35rem)] opacity-0 group-hover:opacity-100"
                              }`}
                              aria-label={`Reply to ${senderLabel(msg.sender_id)}`}
                            >
                              <Reply className="h-3.5 w-3.5" />
                              <span>Reply</span>
                            </button>
                            <MessageBubble
                              mine={!!mine}
                              senderName={mine ? "You" : peerFirstName}
                              showSenderName={!sameCluster}
                              timeLabel={timeLabel}
                              showMeta={showMeta}
                              receiptPhase={outgoingReceiptPhase(msg)}
                              showIncomingRead={!mine && !!msg.read_at}
                              isHighlighted={isHighlighted}
                              avatarUrl={mine ? selfAvatarUrl || getAvatarUrl(null, null, "You") : peerAvatar}
                              avatarDisplayName={mine ? "You" : peerName}
                              showAvatar={!sameCluster}
                              reaction={messageReactions[msg.id] ?? null}
                              bubbleTransformStyle={
                                swipeOffset > 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined
                              }
                              belowBubbleSlot={(() => {
                                const resolved = resolveMessageProductCard(msg);
                                if (!resolved) return null;
                                const { strip, pricePending } = resolved;
                                return (
                                  <ChatPortraitProductCard
                                    productId={strip.id}
                                    title={strip.title}
                                    priceLabel={pricePending ? "…" : formatPrice(strip.price)}
                                    imageUrl={strip.image}
                                  />
                                );
                              })()}
                              replySlot={
                                replyPreview || msg.reply_to_id ? (
                                  <button
                                    type="button"
                                    onClick={() => jumpToMessage(replyPreview?.id ?? msg.reply_to_id)}
                                    className={`mb-2 block w-full rounded-xl border-l-4 px-3 py-2 text-left transition ${
                                      mine
                                        ? "border-white/60 bg-white/18 text-white/95 hover:bg-white/22"
                                        : "border-emerald-500/80 bg-white/40 text-gray-900 hover:bg-white/55"
                                    }`}
                                    aria-label="Jump to original message"
                                  >
                                    <p className="truncate text-[11px] font-semibold">{quotedSender}</p>
                                    <p className="line-clamp-2 text-[12px] leading-snug opacity-90">
                                      {replyPreview
                                        ? messagePreviewText(replyPreview.message, replyPreview.image_url)
                                        : "Original message unavailable"}
                                    </p>
                                  </button>
                                ) : null
                              }
                            >
                              <ChatMessageBubbleBody msg={msg} mine={!!mine} />
                            </MessageBubble>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="min-w-[11rem]">
                          <ContextMenuItem
                            onSelect={() => {
                              selectReply(msg);
                              highlightMessage(msg.id);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                            Reply
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => void copyMessageText(msg)}>
                            <Copy className="h-4 w-4" />
                            Copy
                          </ContextMenuItem>
                          {mine ? (
                            <ContextMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => promptDeleteMessage(msg)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </ContextMenuItem>
                          ) : null}
                          <ContextMenuSeparator />
                          <ContextMenuLabel className="text-xs text-gray-500">Reaction</ContextMenuLabel>
                          {CHAT_REACTION_EMOJIS.map((em) => (
                            <ContextMenuItem key={em} onSelect={() => applyMessageReaction(msg.id, em)}>
                              <span className="text-base leading-none">{em}</span>
                              <span className="sr-only">React with {em}</span>
                            </ContextMenuItem>
                          ))}
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => void forwardMessage(msg)}>
                            <Share2 className="h-4 w-4" />
                            Forward
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </Fragment>
                );
              })}
              {peerTyping ? (
                <div className="mb-2 flex items-center gap-2 text-sm italic text-gray-600">
                  <span className="typing-dots flex gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </span>
                  <span>{peerFirstName} is typing…</span>
                </div>
              ) : null}
              <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
            </div>
          </div>

          <div className="chat-composer-stack sticky bottom-0 z-30 shrink-0 border-t border-emerald-100/90 bg-white/96 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/90 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="message-input-area px-3 py-3 sm:px-4">
              {replyingTo ? (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Replying to {senderLabel(replyingTo.sender_id)}
                  </p>
                  <p className="truncate text-sm text-emerald-950/80">
                    {messagePreviewText(replyingTo.message, replyingTo.image_url)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="shrink-0 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  aria-label="Cancel reply"
                >
                  Cancel
                </button>
              </div>
              ) : null}
              <input
                ref={attachInputRef}
                type="file"
                accept={CHAT_ATTACH_ACCEPT}
                className="hidden"
                onChange={onAttachmentFileChange}
              />
              {pendingAttachment ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {pendingAttachment.previewUrl ? (
                      <img
                        src={pendingAttachment.previewUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/10">
                        <FileText className="h-6 w-6 text-gray-500" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{pendingAttachment.file.name}</p>
                      <p className="text-xs text-gray-500">{formatChatAttachmentBytes(pendingAttachment.file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearPendingAttachment}
                    className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-200"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Attach file"
                title="Attach image, PDF, or Word"
              >
                <Paperclip className="h-5 w-5" />
              </button>
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
              <input
                ref={composerRef}
                type="text"
                name="chat-message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void sendMessage();
                }}
                placeholder="Type a message..."
                autoComplete="off"
                enterKeyHint="send"
                className="message-input min-h-[44px] w-full min-w-0 flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={(!newMessage.trim() && !pendingAttachment) || sendBusy}
                className="send-btn shrink-0 rounded-full bg-[#22c55e] p-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      <Sheet open={mobileActionMessage != null} onOpenChange={(open) => !open && setMobileActionMessage(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-2">
            <SheetTitle>Message actions</SheetTitle>
            <SheetDescription>Press and hold for quick message tools.</SheetDescription>
          </SheetHeader>
          {mobileActionMessage ? (
            <div className="px-4 pb-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-gray-700">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  {senderLabel(mobileActionMessage.sender_id)}
                </p>
                <p className="line-clamp-3">
                  {messagePreviewText(mobileActionMessage.message, mobileActionMessage.image_url)}
                </p>
              </div>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => selectReply(mobileActionMessage)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22c55e] px-4 py-3 text-sm font-semibold text-white"
                >
                  <Reply className="h-4 w-4" />
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => void copyMessageText(mobileActionMessage)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                >
                  <Copy className="h-4 w-4" />
                  Copy text
                </button>
                <div className="flex flex-wrap justify-center gap-2 border-y border-gray-100 py-3">
                  <span className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Reaction
                  </span>
                  {CHAT_REACTION_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="rounded-full bg-gray-100 px-3 py-2 text-xl leading-none transition hover:bg-emerald-100"
                      onClick={() => {
                        applyMessageReaction(mobileActionMessage.id, em);
                        setMobileActionMessage(null);
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                {mobileActionMessage.sender_id === authUser.id ? (
                  <button
                    type="button"
                    onClick={() => promptDeleteMessage(mobileActionMessage)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void forwardMessage(mobileActionMessage)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                >
                  <Share2 className="h-4 w-4" />
                  Forward
                </button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={pendingConfirmAction != null} onOpenChange={(open) => !open && setPendingConfirmAction(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirmAction?.kind === "delete-message"
                ? "Delete message?"
                : pendingConfirmAction?.kind === "delete-conversation"
                  ? "Delete conversation?"
                  : "Clear chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmAction?.kind === "delete-message"
                ? "This removes the message from the conversation."
                : pendingConfirmAction?.kind === "delete-conversation"
                  ? "This deletes the full conversation and returns you to the inbox."
                  : "This tries to remove all messages from the current chat."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-300"
              onClick={(e) => {
                e.preventDefault();
                void runPendingConfirmAction();
              }}
            >
              {actionBusy ? "Working..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const shellHeight =
    "max-md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] max-md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:h-[calc(var(--chat-viewport-height,100dvh)-4rem)] md:max-h-[calc(var(--chat-viewport-height,100dvh)-4rem)]";

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
              const active = conversation?.id === row.id;
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

  return (
    <ChatErrorBoundary>
      <div
        className="h-[calc(var(--chat-viewport-height,100dvh)-4rem)] overflow-hidden bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_22%,#f7fee7_100%)]"
        style={chatShellStyle}
      >
        <div className={`mx-auto grid w-full max-w-[1100px] grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] ${shellHeight}`}>
          <aside className={`hidden min-h-0 flex-col border-r border-emerald-100 bg-white/95 backdrop-blur md:flex ${shellHeight}`}>
            {conversationList}
          </aside>

          <section className={`flex min-h-0 min-w-0 flex-col ${shellHeight}`}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{chatPanel}</div>
          </section>
        </div>
      </div>
    </ChatErrorBoundary>
  );
}
