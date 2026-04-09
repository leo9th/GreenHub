import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvatarUrl } from "./getAvatar";

export type NormalizedReviewProductId = string | number;

type ReviewRow = {
  id: string;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
  user_id: string | null;
};

type ReviewProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
};

export type ProductReviewDisplay = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  reviewer_name: string;
  reviewer_avatar: string;
};

export function normalizeReviewProductId(
  value: string | number | null | undefined,
): NormalizedReviewProductId | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) && String(asNumber) === trimmed ? asNumber : trimmed;
  }
  return null;
}

export function isRecoverableReviewQueryError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid input syntax for type") ||
    normalized.includes("operator does not exist") ||
    normalized.includes("could not find the") ||
    normalized.includes("product_reviews") ||
    normalized.includes("column") ||
    normalized.includes("schema cache")
  );
}

export function isMissingProductReviewsTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("product_reviews") && normalized.includes("does not exist");
}

export function formatProductReviewDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

async function fetchReviewProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ReviewProfileRow>> {
  const profileMap = new Map<string, ReviewProfileRow>();
  if (userIds.length === 0) return profileMap;

  const { data: publicProfiles } = await supabase
    .from("profiles_public")
    .select("id, full_name, avatar_url, gender")
    .in("id", userIds);

  for (const profile of (publicProfiles ?? []) as ReviewProfileRow[]) {
    if (profile.id) profileMap.set(String(profile.id), profile);
  }

  const missingIds = userIds.filter((id) => !profileMap.has(id));
  if (missingIds.length === 0) return profileMap;

  const { data: privateProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, gender")
    .in("id", missingIds);

  for (const profile of (privateProfiles ?? []) as ReviewProfileRow[]) {
    if (profile.id) profileMap.set(String(profile.id), profile);
  }

  return profileMap;
}

export async function fetchProductReviewsForProduct(
  supabase: SupabaseClient,
  productId: string | number | null | undefined,
): Promise<{ data: ProductReviewDisplay[]; error: { message: string } | null }> {
  const normalizedProductId = normalizeReviewProductId(productId);
  if (normalizedProductId == null) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, created_at, user_id")
    .eq("product_id", normalizedProductId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: { message: error.message } };
  }

  const rows = ((data ?? []) as ReviewRow[]).filter(
    (row): row is ReviewRow & { user_id: string } => Boolean(row?.id) && typeof row.user_id === "string" && row.user_id.trim() !== "",
  );
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const profileMap = await fetchReviewProfiles(supabase, userIds);

  return {
    data: rows.map((row) => {
      const profile = profileMap.get(String(row.user_id));
      const reviewerName = profile?.full_name?.trim() || "Member";
      return {
        id: row.id,
        rating: Math.min(5, Math.max(1, Number(row.rating) || 1)),
        comment: String(row.comment ?? ""),
        created_at: row.created_at ?? "",
        user_id: row.user_id,
        reviewer_name: reviewerName,
        reviewer_avatar: getAvatarUrl(profile?.avatar_url ?? null, profile?.gender ?? null, reviewerName),
      };
    }),
    error: null,
  };
}
