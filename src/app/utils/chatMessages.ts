import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMessageRow = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

/**
 * Load thread messages. Tries `chat_messages` first; some projects use table name `messages`.
 */
export async function fetchChatMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ChatMessageRow[]; error: { message: string } | null }> {
  const sel = "id, sender_id, message, created_at";
  const q1 = await supabase
    .from("chat_messages")
    .select(sel)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!q1.error) {
    return { data: (q1.data ?? []) as ChatMessageRow[], error: null };
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
  return { data: (q2.data ?? []) as ChatMessageRow[], error: null };
}
