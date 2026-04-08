import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<void> {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}

export async function markNotificationReadById(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function toggleProductLike(
  supabase: SupabaseClient,
  productId: number,
  userId: string,
  currentlyLiked: boolean,
): Promise<{ error: string | null }> {
  if (currentlyLiked) {
    const { error } = await supabase.from("product_likes").delete().eq("product_id", productId).eq("user_id", userId);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("product_likes")
    .insert({ product_id: productId, user_id: userId });
  return { error: error?.message ?? null };
}

/** `products.like_count` maintained by triggers on `product_likes`. */
export async function fetchProductLikeCount(
  supabase: SupabaseClient,
  productId: number,
): Promise<number> {
  const { data, error } = await supabase.from("products").select("like_count").eq("id", productId).maybeSingle();
  if (error || !data) return 0;
  const n = (data as { like_count?: unknown }).like_count;
  return typeof n === "number" && Number.isFinite(n) ? n : Number(n) || 0;
}

export async function fetchUserLikesProduct(
  supabase: SupabaseClient,
  productId: number,
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

export async function fetchLikedProductIdsForUser(
  supabase: SupabaseClient,
  userId: string,
  productIds: number[],
): Promise<Set<number>> {
  if (productIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("product_likes")
    .select("product_id")
    .eq("user_id", userId)
    .in("product_id", productIds);
  if (error || !data) return new Set();
  return new Set(
    (data as { product_id: number }[])
      .map((r) => Number(r.product_id))
      .filter((n) => Number.isFinite(n)),
  );
}
