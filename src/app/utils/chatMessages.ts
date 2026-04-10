import type { SupabaseClient } from "@supabase/supabase-js";

/** Persisted in DB: sent → delivered → read. `sending` is optimistic UI only (see client_sending). */
export type ChatMessageDeliveryStatus = "sent" | "delivered" | "read";

export type ChatMessageReplyPreview = {
  id: string;
  sender_id: string;
  message: string;
  image_url?: string | null;
};

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
  /** Optional listing attached to this message (portrait card in thread) */
  product_id?: number | null;
  /** Local only: message is being sent to the server */
  client_sending?: boolean;
};

export const CHAT_MESSAGE_BASE_COLUMNS =
  "id, sender_id, message, created_at, status, delivered_at, read_at, reply_to_id, image_url, product_id";

export const CHAT_MESSAGE_COLUMNS =
  `${CHAT_MESSAGE_BASE_COLUMNS}, reply_to:chat_messages!chat_messages_reply_to_id_fkey(id, sender_id, message, image_url)`;

/** Older DBs without `image_url` / full receipt columns — still enough for UI + reply resolution. */
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
    product_id: parseMessageProductId(raw.product_id),
  };
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
 * Load thread messages. Tries `chat_messages` first; some projects use table name `messages`.
 */
export async function fetchChatMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ChatMessageRow[]; error: { message: string } | null }> {
  const selectRows = async (table: "chat_messages" | "messages") => {
    const attempts = [
      CHAT_MESSAGE_COLUMNS,
      CHAT_MESSAGE_BASE_COLUMNS,
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
