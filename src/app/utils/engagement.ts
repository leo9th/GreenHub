import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Primary key value for `products` / `product_likes.product_id` (numeric id or UUID string). */
export type ProductPk = string | number;

/**
 * Coerce route/row product ids for PostgREST: finite numbers, digit strings → number when safe,
 * otherwise trimmed string (UUID etc.). Avoids `Number(uuid)` → NaN.
 */
export function normalizeProductPk(raw: unknown): ProductPk | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isSafeInteger(n)) return n;
      return t;
    }
    return t;
  }
  return null;
}

/** Stable Set/Map key for a product id (aligns numeric 1 with "1"). */
export function productLikeSetKey(pk: ProductPk): string {
  return typeof pk === "number" ? String(pk) : pk.trim();
}

/** Key for comparing product rows from mixed `unknown` ids. */
export function productRowKey(raw: unknown): string {
  const pk = normalizeProductPk(raw);
  if (pk != null) return productLikeSetKey(pk);
  return raw == null ? "" : String(raw).trim();
}

export async function fetchTotalUnreadMessages(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("total_unread_message_count");
  if (error) return 0;
  return typeof data === "number" ? data : Number(data) || 0;
}

export async function fetchInboxUnreadByConversation(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("inbox_unread_by_conversation");
  const map = new Map<string, number>();
  if (error || !data) return map;
  for (const row of data as { conversation_id: string; unread_count: number | string }[]) {
    map.set(String(row.conversation_id), Number(row.unread_count) || 0);
  }
  return map;
}

export type AppNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function fetchRecentNotifications(
  supabase: SupabaseClient,
  limit = 40,
): Promise<AppNotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, body, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AppNotificationRow[];
}

export async function markAllNotificationsRead(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

export async function markNotificationReadById(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function toggleProductLike(
  supabase: SupabaseClient,
  productId: ProductPk,
  userId: string,
  currentlyLiked: boolean,
): Promise<{ error: string | null }> {
  console.debug("[toggleProductLike]", { productId, userId, currentlyLiked });
  if (currentlyLiked) {
    const { error } = await supabase.from("product_likes").delete().eq("product_id", productId).eq("user_id", userId);
    if (error) console.debug("[toggleProductLike] delete error", error.message);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("product_likes")
    .insert({ product_id: productId, user_id: userId });
  if (error?.code === "23505") {
    return { error: null };
  }
  if (error) console.debug("[toggleProductLike] insert error", error.message, error);
  return { error: error?.message ?? null };
}

/** `products.like_count` maintained by triggers on `product_likes`. */
export async function fetchProductLikeCount(
  supabase: SupabaseClient,
  productId: ProductPk,
): Promise<number> {
  const { data, error } = await supabase.from("products").select("like_count").eq("id", productId).maybeSingle();
  if (error || !data) return 0;
  const n = (data as { like_count?: unknown }).like_count;
  return typeof n === "number" && Number.isFinite(n) ? n : Number(n) || 0;
}

export async function fetchUserLikesProduct(
  supabase: SupabaseClient,
  productId: ProductPk,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("product_likes")
    .select("product_id")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export function subscribeToProductLikes(
  supabase: SupabaseClient,
  productId: ProductPk,
  onLikeCount: (count: number) => void,
): RealtimeChannel {
  const chId = typeof productId === "number" ? String(productId) : productId;
  return supabase
    .channel(`product-like-count:${chId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "products",
        filter: `id=eq.${productId}`,
      },
      (payload) => {
        const raw = (payload.new as { like_count?: unknown })?.like_count;
        const next = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
        if (Number.isFinite(next)) onLikeCount(next);
      },
    )
    .subscribe();
}

export async function fetchLikedProductIdsForUser(
  supabase: SupabaseClient,
  userId: string,
  productIds: ProductPk[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("product_likes")
    .select("product_id")
    .eq("user_id", userId)
    .in("product_id", productIds);
  if (error || !data) return new Set();
  const keys = new Set<string>();
  for (const r of data as { product_id: string | number }[]) {
    const pk = normalizeProductPk(r.product_id);
    if (pk != null) keys.add(productLikeSetKey(pk));
  }
  return keys;
}
