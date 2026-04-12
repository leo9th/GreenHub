import type { SupabaseClient } from "@supabase/supabase-js";

/** Single follower count via existing RPC (anon-safe). */
export async function fetchProfileFollowerCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("profile_follower_count", { p_user_id: userId });
  if (error || data == null) return 0;
  return Number(data);
}

export async function fetchProfileFollowStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [fr, fw] = await Promise.all([
    supabase.rpc("profile_follower_count", { p_user_id: userId }),
    supabase.rpc("profile_following_count", { p_user_id: userId }),
  ]);
  return {
    followers: fr.error || fr.data == null ? 0 : Number(fr.data),
    following: fw.error || fw.data == null ? 0 : Number(fw.data),
  };
}

/** Deduped parallel RPCs for listing grids (one call per distinct seller). */
export async function fetchProfileFollowerCountsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(userIds.map((id) => String(id).trim()).filter(Boolean))];
  const out: Record<string, number> = {};
  if (unique.length === 0) return out;
  await Promise.all(
    unique.map(async (id) => {
      const n = await fetchProfileFollowerCount(supabase, id);
      out[id] = n;
    }),
  );
  return out;
}
