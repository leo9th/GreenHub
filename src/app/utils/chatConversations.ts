import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProductPk, type ProductPk } from "./engagement";

export type ConversationRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  context_product_id: ProductPk | null;
  buyer_last_read_at: string | null;
  seller_last_read_at: string | null;
};

export type ConversationListRow = ConversationRow & {
  /** Matches DB column `last_message` (legacy `last_message_preview` still read if present). */
  last_message: string | null;
  last_message_at: string | null;
};

function pickLastMessageText(raw: Record<string, unknown>): string | null {
  const v = raw.last_message ?? raw.last_message_preview;
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normalizeListRow(raw: Record<string, unknown>): ConversationListRow {
  return {
    id: String(raw.id),
    buyer_id: String(raw.buyer_id),
    seller_id: String(raw.seller_id),
    context_product_id: normalizeProductPk(raw.context_product_id),
    buyer_last_read_at: (raw.buyer_last_read_at as string | null) ?? null,
    seller_last_read_at: (raw.seller_last_read_at as string | null) ?? null,
    last_message: pickLastMessageText(raw),
    last_message_at: (raw.last_message_at as string | null) ?? null,
  };
}

function parseIso(a: string | null | undefined): number {
  if (a == null || String(a).trim() === "") return 0;
  const t = new Date(a).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Inbox: rows where the user is buyer_id OR seller_id.
 * Uses two `.eq` queries instead of `.or(...)` — PostgREST often returns 400 on combined UUID filters.
 */
export async function fetchConversationsForInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ConversationListRow[]; error: { message: string } | null }> {
  const fields =
    "id, buyer_id, seller_id, context_product_id, buyer_last_read_at, seller_last_read_at, last_message, last_message_at";

  const [asBuyer, asSeller] = await Promise.all([
    supabase.from("conversations").select(fields).eq("buyer_id", userId),
    supabase.from("conversations").select(fields).eq("seller_id", userId),
  ]);

  const err = asBuyer.error ?? asSeller.error;
  if (err) return { data: [], error: { message: err.message } };

  const byId = new Map<string, ConversationListRow>();
  const addRows = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) {
      const row = normalizeListRow(r);
      byId.set(row.id, row);
    }
  };
  addRows((asBuyer.data ?? []) as Record<string, unknown>[]);
  addRows((asSeller.data ?? []) as Record<string, unknown>[]);

  const list = [...byId.values()].sort(
    (x, y) => parseIso(y.last_message_at) - parseIso(x.last_message_at),
  );
  return { data: list, error: null };
}

/** Fetch one conversation by id (Chat thread). */
export async function fetchConversationById(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: ConversationRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, context_product_id, buyer_last_read_at, seller_last_read_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: null };
  const n = normalizeListRow({ ...(data as Record<string, unknown>), last_message: null, last_message_at: null });
  return {
    data: {
      id: n.id,
      buyer_id: n.buyer_id,
      seller_id: n.seller_id,
      context_product_id: n.context_product_id,
      buyer_last_read_at: n.buyer_last_read_at,
      seller_last_read_at: n.seller_last_read_at,
    },
    error: null,
  };
}

/** Postgres unique violation / duplicate pair — retry with `findConversationByPair`. */
export function isDuplicateConversationError(err: { code?: string; message?: string }): boolean {
  const c = String(err.code ?? "");
  const m = String(err.message ?? "").toLowerCase();
  return c === "23505" || m.includes("duplicate") || m.includes("unique") || m.includes("conversations_pair");
}

export type InsertConversationOpts = {
  contextProductId?: ProductPk | null;
};

/** Start a DM: current user is buyer, peer is seller (typical “message seller” flow). */
export async function insertConversationPair(
  supabase: SupabaseClient,
  buyerUserId: string,
  sellerUserId: string,
  opts?: InsertConversationOpts,
): Promise<{ data: ConversationRow | null; error: { message: string; code?: string } | null }> {
  const insertPayload: Record<string, unknown> = { buyer_id: buyerUserId, seller_id: sellerUserId };
  const pid = opts?.contextProductId;
  if (pid != null) insertPayload.context_product_id = pid;

  const { data, error } = await supabase
    .from("conversations")
    .insert(insertPayload)
    .select("id, buyer_id, seller_id, context_product_id, buyer_last_read_at, seller_last_read_at")
    .single();

  if (error) return { data: null, error: { message: error.message, code: error.code } };
  const raw = data as Record<string, unknown>;
  const n = normalizeListRow({ ...raw, last_message: null, last_message_at: null });
  return {
    data: {
      id: n.id,
      buyer_id: n.buyer_id,
      seller_id: n.seller_id,
      context_product_id: n.context_product_id,
      buyer_last_read_at: n.buyer_last_read_at,
      seller_last_read_at: n.seller_last_read_at,
    },
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
    .select("id, buyer_id, seller_id, context_product_id, buyer_last_read_at, seller_last_read_at")
    .eq("buyer_id", userA)
    .eq("seller_id", userB)
    .maybeSingle();
  if (e1) throw e1;
  if (row1) {
    const n = normalizeListRow({ ...(row1 as Record<string, unknown>), last_message: null, last_message_at: null });
    return {
      id: n.id,
      buyer_id: n.buyer_id,
      seller_id: n.seller_id,
      context_product_id: n.context_product_id,
      buyer_last_read_at: n.buyer_last_read_at,
      seller_last_read_at: n.seller_last_read_at,
    };
  }

  const { data: row2, error: e2 } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, context_product_id, buyer_last_read_at, seller_last_read_at")
    .eq("buyer_id", userB)
    .eq("seller_id", userA)
    .maybeSingle();
  if (e2) throw e2;
  if (!row2) return null;
  const n = normalizeListRow({ ...(row2 as Record<string, unknown>), last_message: null, last_message_at: null });
  return {
    id: n.id,
    buyer_id: n.buyer_id,
    seller_id: n.seller_id,
    context_product_id: n.context_product_id,
    buyer_last_read_at: n.buyer_last_read_at,
    seller_last_read_at: n.seller_last_read_at,
  };
}

/**
 * The other user in the thread (peer), given the current user id.
 * Uses buyer_id / seller_id only (not participant_a/b).
 */
export function otherParticipantId(conv: ConversationRow, me: string): string | null {
  if (conv.buyer_id === me) return conv.seller_id;
  if (conv.seller_id === me) return conv.buyer_id;
  return null;
}

/** Alias for readability in UI code. */
export const otherPartyUserId = otherParticipantId;

/** When `me` is buyer, peer is seller → use `seller_last_read_at`; when `me` is seller, use `buyer_last_read_at`. */
export function peerLastReadAt(conv: ConversationRow, me: string): string | null {
  if (conv.buyer_id === me) return conv.seller_last_read_at;
  if (conv.seller_id === me) return conv.buyer_last_read_at;
  return null;
}

export function isOutgoingReadByPeer(conv: ConversationRow, me: string, messageCreatedAt: string): boolean {
  const peerRead = peerLastReadAt(conv, me);
  if (!peerRead) return false;
  return new Date(peerRead).getTime() >= new Date(messageCreatedAt).getTime();
}

/** Mark this user’s “opened thread up to now” time (drives read receipts for the other party). */
export async function updateConversationLastRead(
  supabase: SupabaseClient,
  conv: ConversationRow,
  me: string,
): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();
  const patch: Record<string, string> =
    conv.buyer_id === me
      ? { buyer_last_read_at: now }
      : conv.seller_id === me
        ? { seller_last_read_at: now }
        : {};
  if (Object.keys(patch).length === 0) return { error: { message: "Not a participant" } };
  const { error } = await supabase.from("conversations").update(patch).eq("id", conv.id);
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function setConversationContextProduct(
  supabase: SupabaseClient,
  conversationId: string,
  productId: ProductPk,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("conversations")
    .update({ context_product_id: productId })
    .eq("id", conversationId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function clearConversationContextProduct(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("conversations")
    .update({ context_product_id: null })
    .eq("id", conversationId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}
