import type { SupabaseClient } from "@supabase/supabase-js";

/** Persisted in DB: sent → delivered → read. `sending` is optimistic UI only (see client_sending). */
export type ChatMessageDeliveryStatus = "sent" | "delivered" | "read";

export type ChatMessageRow = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  status: ChatMessageDeliveryStatus | string;
  delivered_at: string | null;
  read_at: string | null;
  /** Local only: message is being sent to the server */
  client_sending?: boolean;
};

export const CHAT_MESSAGE_COLUMNS =
  "id, sender_id, message, created_at, status, delivered_at, read_at";

export function normalizeChatMessageRow(raw: Record<string, unknown>): ChatMessageRow {
  const st = raw.status;
  const status: ChatMessageDeliveryStatus =
    st === "delivered" || st === "read" || st === "sent" ? st : "sent";
  return {
    id: String(raw.id),
    sender_id: String(raw.sender_id),
    message: String(raw.message ?? ""),
    created_at: String(raw.created_at ?? ""),
    status,
    delivered_at: (raw.delivered_at as string | null) ?? null,
    read_at: (raw.read_at as string | null) ?? null,
  };
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
  const sel = CHAT_MESSAGE_COLUMNS;
  const q1 = await supabase
    .from("chat_messages")
    .select(sel)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!q1.error) {
    const rows = (q1.data ?? []).map((r) => normalizeChatMessageRow(r as Record<string, unknown>));
    return { data: rows, error: null };
  }

  const msg = (q1.error.message || "").toLowerCase();
  const missing =
    msg.includes("does not exist") || q1.error.code === "42P01" || q1.error.code === "PGRST205";

  if (!missing) {
    return { data: [], error: { message: q1.error.message } };
  }

  const q2 = await supabase
    .from("messages")
    .select(sel)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (q2.error) {
    return { data: [], error: { message: q2.error.message } };
  }
  const rows = (q2.data ?? []).map((r) => normalizeChatMessageRow(r as Record<string, unknown>));
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
