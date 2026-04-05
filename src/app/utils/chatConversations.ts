import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
};

/** Inbox row includes preview fields (normalized so participant_a = buyer, participant_b = seller when using buyer/seller schema). */
export type ConversationListRow = ConversationRow & {
  last_message_preview: string | null;
  last_message_at: string | null;
};

export type ConversationTableSchema = "participants" | "buyer_seller";

let cachedConversationSchema: ConversationTableSchema | null = null;

/** Detect whether `conversations` uses buyer_id/seller_id or participant_a/participant_b (cached). */
export async function getConversationTableSchema(supabase: SupabaseClient): Promise<ConversationTableSchema> {
  if (cachedConversationSchema) return cachedConversationSchema;
  const probe = await supabase.from("conversations").select("buyer_id").limit(1);
  if (!probe.error) {
    cachedConversationSchema = "buyer_seller";
    return cachedConversationSchema;
  }
  cachedConversationSchema = "participants";
  return cachedConversationSchema;
}

function normalizeListRow(raw: Record<string, unknown>, schema: ConversationTableSchema): ConversationListRow {
  if (schema === "buyer_seller") {
    return {
      id: String(raw.id),
      participant_a: String(raw.buyer_id),
      participant_b: String(raw.seller_id),
      last_message_preview: (raw.last_message_preview as string | null) ?? null,
      last_message_at: (raw.last_message_at as string | null) ?? null,
    };
  }
  return {
    id: String(raw.id),
    participant_a: String(raw.participant_a),
    participant_b: String(raw.participant_b),
    last_message_preview: (raw.last_message_preview as string | null) ?? null,
    last_message_at: (raw.last_message_at as string | null) ?? null,
  };
}

/** Load all conversations for the Messages inbox (supports both table shapes). */
export async function fetchConversationsForInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ConversationListRow[]; error: { message: string } | null }> {
  const schema = await getConversationTableSchema(supabase);
  const fields =
    schema === "buyer_seller"
      ? "id, buyer_id, seller_id, last_message_preview, last_message_at"
      : "id, participant_a, participant_b, last_message_preview, last_message_at";
  const orFilter =
    schema === "buyer_seller"
      ? `buyer_id.eq.${userId},seller_id.eq.${userId}`
      : `participant_a.eq.${userId},participant_b.eq.${userId}`;

  const { data, error } = await supabase
    .from("conversations")
    .select(fields)
    .or(orFilter)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: { message: error.message } };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { data: rows.map((r) => normalizeListRow(r, schema)), error: null };
}

/** Fetch one conversation by id (for Chat header / thread). */
export async function fetchConversationById(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ConversationRow | null; error: { message: string } | null }> {
  const schema = await getConversationTableSchema(supabase);
  const fields = schema === "buyer_seller" ? "id, buyer_id, seller_id" : "id, participant_a, participant_b";
  const { data, error } = await supabase.from("conversations").select(fields).eq("id", conversationId).maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: null };
  const raw = data as Record<string, unknown>;
  const normalized = normalizeListRow(
    { ...raw, last_message_preview: null, last_message_at: null },
    schema,
  );
  return {
    data: {
      id: normalized.id,
      participant_a: normalized.participant_a,
      participant_b: normalized.participant_b,
    },
    error: null,
  };
}

/** Insert a new conversation (tries the shape that matches your table). */
export async function insertConversationPair(
  supabase: SupabaseClient,
  me: string,
  peer: string,
): Promise<{ data: ConversationRow | null; error: { message: string; code?: string } | null }> {
  const schema = await getConversationTableSchema(supabase);
  const insertPayload =
    schema === "buyer_seller"
      ? { buyer_id: me, seller_id: peer }
      : { participant_a: me, participant_b: peer };
  const selectFields = schema === "buyer_seller" ? "id, buyer_id, seller_id" : "id, participant_a, participant_b";

  const { data, error } = await supabase.from("conversations").insert(insertPayload).select(selectFields).single();

  if (error) return { data: null, error: { message: error.message, code: error.code } };
  const raw = data as Record<string, unknown>;
  const n = normalizeListRow(
    { ...raw, last_message_preview: null, last_message_at: null },
    schema,
  );
  return {
    data: { id: n.id, participant_a: n.participant_a, participant_b: n.participant_b },
    error: null,
  };
}

/** Find a row where the two users are the pair (either column set, order-independent for participants; both orderings for buyer/seller). */
export async function findConversationByPair(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<ConversationRow | null> {
  const schema = await getConversationTableSchema(supabase);

  if (schema === "buyer_seller") {
    const { data: row1, error: e1 } = await supabase
      .from("conversations")
      .select("id, buyer_id, seller_id")
      .eq("buyer_id", userA)
      .eq("seller_id", userB)
      .maybeSingle();
    if (e1) throw e1;
    if (row1) {
      const n = normalizeListRow(
        { ...(row1 as Record<string, unknown>), last_message_preview: null, last_message_at: null },
        schema,
      );
      return { id: n.id, participant_a: n.participant_a, participant_b: n.participant_b };
    }
    const { data: row2, error: e2 } = await supabase
      .from("conversations")
      .select("id, buyer_id, seller_id")
      .eq("buyer_id", userB)
      .eq("seller_id", userA)
      .maybeSingle();
    if (e2) throw e2;
    if (!row2) return null;
    const n = normalizeListRow(
      { ...(row2 as Record<string, unknown>), last_message_preview: null, last_message_at: null },
      schema,
    );
    return { id: n.id, participant_a: n.participant_a, participant_b: n.participant_b };
  }

  const { data: row1, error: e1 } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("participant_a", userA)
    .eq("participant_b", userB)
    .maybeSingle();

  if (e1) throw e1;
  if (row1) return row1 as ConversationRow;

  const { data: row2, error: e2 } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("participant_a", userB)
    .eq("participant_b", userA)
    .maybeSingle();

  if (e2) throw e2;
  return (row2 as ConversationRow | null) ?? null;
}

export function otherParticipantId(conv: ConversationRow, me: string): string | null {
  if (conv.participant_a === me) return conv.participant_b;
  if (conv.participant_b === me) return conv.participant_a;
  return null;
}
