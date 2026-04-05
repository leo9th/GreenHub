import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
};

export type ConversationListRow = ConversationRow & {
  last_message_preview: string | null;
  last_message_at: string | null;
};

function normalizeListRow(raw: Record<string, unknown>): ConversationListRow {
  return {
    id: String(raw.id),
    buyer_id: String(raw.buyer_id),
    seller_id: String(raw.seller_id),
    last_message_preview: (raw.last_message_preview as string | null) ?? null,
    last_message_at: (raw.last_message_at as string | null) ?? null,
  };
}

/** Load all conversations where the user is the buyer or the seller. */
export async function fetchConversationsForInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ConversationListRow[]; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, last_message_preview, last_message_at")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: { message: error.message } };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { data: rows.map((r) => normalizeListRow(r)), error: null };
}

/** Fetch one conversation by id (Chat thread). */
export async function fetchConversationById(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ConversationRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: null };
  const n = normalizeListRow({ ...(data as Record<string, unknown>), last_message_preview: null, last_message_at: null });
  return {
    data: { id: n.id, buyer_id: n.buyer_id, seller_id: n.seller_id },
    error: null,
  };
}

/** Start a DM: current user is buyer, peer is seller (typical “message seller” flow). */
export async function insertConversationPair(
  supabase: SupabaseClient,
  buyerUserId: string,
  sellerUserId: string,
): Promise<{ data: ConversationRow | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ buyer_id: buyerUserId, seller_id: sellerUserId })
    .select("id, buyer_id, seller_id")
    .single();

  if (error) return { data: null, error: { message: error.message, code: error.code } };
  const raw = data as Record<string, unknown>;
  const n = normalizeListRow({ ...raw, last_message_preview: null, last_message_at: null });
  return {
    data: { id: n.id, buyer_id: n.buyer_id, seller_id: n.seller_id },
    error: null,
  };
}

/** Find existing row for this buyer–seller pair (either orientation). */
export async function findConversationByPair(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<ConversationRow | null> {
  const { data: row1, error: e1 } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("buyer_id", userA)
    .eq("seller_id", userB)
    .maybeSingle();
  if (e1) throw e1;
  if (row1) {
    const n = normalizeListRow({ ...(row1 as Record<string, unknown>), last_message_preview: null, last_message_at: null });
    return { id: n.id, buyer_id: n.buyer_id, seller_id: n.seller_id };
  }

  const { data: row2, error: e2 } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("buyer_id", userB)
    .eq("seller_id", userA)
    .maybeSingle();
  if (e2) throw e2;
  if (!row2) return null;
  const n = normalizeListRow({ ...(row2 as Record<string, unknown>), last_message_preview: null, last_message_at: null });
  return { id: n.id, buyer_id: n.buyer_id, seller_id: n.seller_id };
}

/** The other person in the thread (given the current user id). */
export function otherParticipantId(conv: ConversationRow, me: string): string | null {
  if (conv.buyer_id === me) return conv.seller_id;
  if (conv.seller_id === me) return conv.buyer_id;
  return null;
}
