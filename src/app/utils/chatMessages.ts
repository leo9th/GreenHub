import type { SupabaseClient } from "@supabase/supabase-js";

/** Persisted in DB: sent → delivered → read. `sending` is optimistic UI only (see client_sending). */
export type ChatMessageDeliveryStatus = "sent" | "delivered" | "read";

export type ChatMessageReplyPreview = {
  id: string;
  sender_id: string;
  message: string;
  image_url?: string | null;
};

export type ChatReactionSummary = { emoji: string; count: number };

export type ChatMessageRow = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  status: ChatMessageDeliveryStatus | string;
  delivered_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  reply_preview: ChatMessageReplyPreview | null;
  image_url?: string | null;
  /** Voice or other non-image media */
  media_url?: string | null;
  edited?: boolean;
  edited_at?: string | null;
  /** Sender cleared content for all participants */
  deleted_for_everyone?: boolean;
  /** User ids who chose “delete for me” */
  deleted_for?: string[] | null;
  /** Optional listing attached to this message (portrait card in thread) */
  product_id?: number | null;
  /** Local only: message is being sent to the server */
  client_sending?: boolean;
};

/** WhatsApp-style edit window (15 minutes). */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const CHAT_MESSAGE_DELETED_PLACEHOLDER = "This message was deleted.";
export const CHAT_MESSAGE_DELETED_FOR_ME_PLACEHOLDER = "This message was removed.";

export const CHAT_MESSAGE_BASE_COLUMNS =
  "id, sender_id, message, created_at, status, delivered_at, read_at, reply_to_id, image_url, media_url, edited, edited_at, deleted_for_everyone, deleted_for, product_id";

/** Flat select only — no `reply_to` embed (avoids PGRST204 self-FK relationship errors). Use resolveChatMessageReplyPreviews(). */
export const CHAT_MESSAGE_COLUMNS = CHAT_MESSAGE_BASE_COLUMNS;

/** DB without newer columns — fallback selects. */
const CHAT_MESSAGE_BASE_NO_MEDIA_EDIT =
  "id, sender_id, message, created_at, status, delivered_at, read_at, reply_to_id, image_url, product_id";

const CHAT_MESSAGE_BASE_NO_PRODUCT_ID =
  "id, sender_id, message, created_at, status, delivered_at, read_at, reply_to_id, image_url, media_url, edited";

const CHAT_MESSAGE_CORE_COLUMNS =
  "id, sender_id, message, created_at, status, delivered_at, read_at, reply_to_id";

const CHAT_MESSAGE_LEGACY_COLUMNS = "id, sender_id, message, created_at";

function normalizeReplyPreview(raw: unknown): ChatMessageReplyPreview | null {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.id == null || row.sender_id == null) return null;
  return {
    id: String(row.id),
    sender_id: String(row.sender_id),
    message: String(row.message ?? ""),
    image_url: (row.image_url as string | null | undefined) ?? null,
  };
}

export function resolveChatMessageReplyPreviews(rows: ChatMessageRow[]): ChatMessageRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    if (row.reply_preview || !row.reply_to_id) return row;
    const target = byId.get(row.reply_to_id);
    if (!target) return row;
    return {
      ...row,
      reply_preview: {
        id: target.id,
        sender_id: target.sender_id,
        message: target.message,
        image_url: target.image_url ?? null,
      },
    };
  });
}

export function normalizeChatMessageRow(raw: Record<string, unknown>): ChatMessageRow {
  const st = raw.status;
  const status: ChatMessageDeliveryStatus =
    st === "delivered" || st === "read" || st === "sent" ? st : "sent";
  const replyPreview =
    normalizeReplyPreview(raw.reply_preview) ??
    normalizeReplyPreview(raw.reply_to) ??
    normalizeReplyPreview(raw.replied_message);
  const editedRaw = raw.edited;
  const edited = editedRaw === true || editedRaw === "true";
  const editedAtRaw = raw.edited_at;
  const edited_at =
    typeof editedAtRaw === "string" && editedAtRaw ? editedAtRaw : editedAtRaw instanceof Date ? editedAtRaw.toISOString() : null;
  const dfe = raw.deleted_for_everyone;
  const deleted_for_everyone = dfe === true || dfe === "true" || dfe === "t";
  const df = raw.deleted_for;
  let deleted_for: string[] | null = null;
  if (Array.isArray(df)) {
    deleted_for = df.map((x) => String(x));
  } else if (df != null && typeof df === "string") {
    try {
      const parsed = JSON.parse(df) as unknown;
      deleted_for = Array.isArray(parsed) ? parsed.map((x) => String(x)) : null;
    } catch {
      deleted_for = null;
    }
  }
  return {
    id: String(raw.id),
    sender_id: String(raw.sender_id),
    message: String(raw.message ?? ""),
    created_at: String(raw.created_at ?? ""),
    status,
    delivered_at: (raw.delivered_at as string | null) ?? null,
    read_at: (raw.read_at as string | null) ?? null,
    reply_to_id: (raw.reply_to_id as string | null) ?? null,
    reply_preview: replyPreview,
    image_url: (raw.image_url as string | null | undefined) ?? null,
    media_url: (raw.media_url as string | null | undefined) ?? null,
    edited,
    edited_at,
    deleted_for_everyone,
    deleted_for,
    product_id: parseMessageProductId(raw.product_id),
  };
}

export function canEditMessage(msg: ChatMessageRow, userId: string | undefined): boolean {
  if (!userId || msg.sender_id !== userId) return false;
  if (msg.client_sending) return false;
  if (msg.deleted_for_everyone) return false;
  if ((msg.deleted_for ?? []).includes(userId)) return false;
  const t = new Date(msg.created_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= MESSAGE_EDIT_WINDOW_MS;
}

export function isMessageHiddenForViewer(msg: ChatMessageRow, viewerId: string | undefined): boolean {
  if (!viewerId) return false;
  return (msg.deleted_for ?? []).includes(viewerId);
}

export function isDeletedForEveryone(msg: ChatMessageRow): boolean {
  return !!msg.deleted_for_everyone;
}

function parseMessageProductId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Outgoing message receipt UI phase (includes optimistic sending). */
export function outgoingReceiptPhase(msg: ChatMessageRow): "sending" | "sent" | "delivered" | "read" {
  if (msg.client_sending) return "sending";
  if (msg.read_at != null || msg.status === "read") return "read";
  if (msg.delivered_at != null || msg.status === "delivered") return "delivered";
  return "sent";
}

/**
 * Load thread messages from `chat_messages` (or legacy `messages` table name).
 */
export async function fetchChatMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ChatMessageRow[]; error: { message: string } | null }> {
  const selectRows = async (table: "chat_messages" | "messages") => {
    // No reply_to embeds — they often cause PGRST204/400 if FK hint or schema cache differs.
    const attempts = [
      CHAT_MESSAGE_BASE_COLUMNS,
      CHAT_MESSAGE_BASE_NO_MEDIA_EDIT,
      CHAT_MESSAGE_BASE_NO_PRODUCT_ID,
      CHAT_MESSAGE_CORE_COLUMNS,
      CHAT_MESSAGE_LEGACY_COLUMNS,
      "*",
    ];
    let last = await supabase
      .from(table)
      .select(attempts[0])
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    for (let i = 1; i < attempts.length && last.error; i++) {
      last = await supabase
        .from(table)
        .select(attempts[i])
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
    }
    return last;
  };
  const q1 = await selectRows("chat_messages");

  if (!q1.error) {
    const rows = resolveChatMessageReplyPreviews(
      (q1.data ?? []).map((r) => normalizeChatMessageRow(r as Record<string, unknown>)),
    );
    return { data: rows, error: null };
  }

  const msg = (q1.error.message || "").toLowerCase();
  const missing =
    msg.includes("does not exist") || q1.error.code === "42P01" || q1.error.code === "PGRST205";

  if (!missing) {
    return { data: [], error: { message: q1.error.message } };
  }

  const q2 = await selectRows("messages");

  if (q2.error) {
    return { data: [], error: { message: q2.error.message } };
  }
  const rows = resolveChatMessageReplyPreviews(
    (q2.data ?? []).map((r) => normalizeChatMessageRow(r as Record<string, unknown>)),
  );
  return { data: rows, error: null };
}

export async function markConversationMessagesDelivered(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("mark_conversation_messages_delivered", {
    p_conversation_id: conversationId,
  });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function markConversationMessagesRead(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("mark_conversation_messages_read", {
    p_conversation_id: conversationId,
  });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export type MessageReactionsState = {
  summaries: ChatReactionSummary[];
  myEmoji: string | null;
};

/** Load emoji reactions for a set of message ids (aggregated per emoji). */
export async function fetchMessageReactions(
  supabase: SupabaseClient,
  conversationId: string,
  messageIds: string[],
  currentUserId: string | null,
): Promise<{ byMessage: Record<string, MessageReactionsState>; error: { message: string } | null }> {
  if (messageIds.length === 0) return { byMessage: {}, error: null };
  const { data, error } = await supabase
    .from("chat_message_reactions")
    .select("message_id, emoji, user_id")
    .eq("conversation_id", conversationId)
    .in("message_id", messageIds);
  if (error) return { byMessage: {}, error: { message: error.message } };

  type Acc = { counts: Record<string, number>; myEmoji: string | null };
  const accByMessage: Record<string, Acc> = {};
  for (const row of data ?? []) {
    const mid = String((row as { message_id: string }).message_id);
    const emoji = String((row as { emoji: string }).emoji);
    const uid = String((row as { user_id: string }).user_id);
    if (!accByMessage[mid]) accByMessage[mid] = { counts: {}, myEmoji: null };
    accByMessage[mid].counts[emoji] = (accByMessage[mid].counts[emoji] ?? 0) + 1;
    if (currentUserId && uid === currentUserId) accByMessage[mid].myEmoji = emoji;
  }

  const byMessage: Record<string, MessageReactionsState> = {};
  for (const mid of Object.keys(accByMessage)) {
    const { counts, myEmoji } = accByMessage[mid];
    const summaries = Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
    summaries.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    byMessage[mid] = { summaries, myEmoji };
  }
  return { byMessage, error: null };
}

/** One row per (message, user); upsert replaces emoji. */
export async function setMessageReaction(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    messageId: string;
    userId: string;
    emoji: string;
  },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("chat_message_reactions").upsert(
    {
      conversation_id: params.conversationId,
      message_id: params.messageId,
      user_id: params.userId,
      emoji: params.emoji,
    },
    { onConflict: "message_id,user_id" },
  );
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function removeOwnMessageReaction(
  supabase: SupabaseClient,
  messageId: string,
  userId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("chat_message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}
