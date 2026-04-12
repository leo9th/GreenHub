import type { SupabaseClient } from "@supabase/supabase-js";

export type PinnedMessageRow = {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
};

export async function clearConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("clear_conversation_messages", {
    p_conversation_id: conversationId,
  });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

/** Whether `messageId` is saved by this user. */
export async function fetchSavedMessageIds(
  supabase: SupabaseClient,
  userId: string,
  messageIds: string[],
): Promise<{ ids: Set<string>; error: { message: string } | null }> {
  if (messageIds.length === 0) return { ids: new Set(), error: null };
  const { data, error } = await supabase
    .from("saved_messages")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);
  if (error) return { ids: new Set(), error: { message: error.message } };
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const mid = (row as { message_id: string }).message_id;
    if (mid) ids.add(String(mid));
  }
  return { ids, error: null };
}

export async function toggleSavedMessage(
  supabase: SupabaseClient,
  params: { userId: string; messageId: string; currentlyStarred: boolean },
): Promise<{ error: { message: string } | null }> {
  if (params.currentlyStarred) {
    const { error } = await supabase
      .from("saved_messages")
      .delete()
      .eq("user_id", params.userId)
      .eq("message_id", params.messageId);
    if (error) return { error: { message: error.message } };
    return { error: null };
  }
  const { error } = await supabase.from("saved_messages").insert({
    user_id: params.userId,
    message_id: params.messageId,
  });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function fetchPinnedMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: PinnedMessageRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("pinned_messages")
    .select("id, conversation_id, message_id, pinned_by, created_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: null };
  const r = data as Record<string, unknown>;
  return {
    data: {
      id: String(r.id),
      conversation_id: String(r.conversation_id),
      message_id: String(r.message_id),
      pinned_by: String(r.pinned_by),
      created_at: String(r.created_at ?? ""),
    },
    error: null,
  };
}

/** One pinned message per conversation (upsert). */
export async function upsertPinnedMessage(
  supabase: SupabaseClient,
  params: { conversationId: string; messageId: string; pinnedBy: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("pinned_messages").upsert(
    {
      conversation_id: params.conversationId,
      message_id: params.messageId,
      pinned_by: params.pinnedBy,
    },
    { onConflict: "conversation_id" },
  );
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function unpinConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("pinned_messages").delete().eq("conversation_id", conversationId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}
