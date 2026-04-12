import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches product profile settings (2 MB cap on profile page). */
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function validateProfileImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please choose an image file (JPEG, PNG, or WebP).";
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return "Image must be 2 MB or smaller.";
  }
  return null;
}

/**
 * Upload to existing public `avatars` bucket under `{userId}/{role}_{timestamp}.ext`.
 * Policies require the first path segment to equal `auth.uid()`.
 */
export async function uploadProfileImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  role: "avatar" | "cover",
): Promise<string> {
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filePath = `${userId}/${role}_${Date.now()}.${rawExt}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) throw new Error(uploadError.message || "Upload failed.");
  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl;
}
