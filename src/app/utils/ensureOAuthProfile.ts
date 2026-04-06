import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export function isOAuthUser(user: User): boolean {
  const provider = user.app_metadata?.provider;
  const ids = user.identities?.map((i) => i.provider) ?? [];
  return (
    provider === "google" ||
    provider === "facebook" ||
    ids.includes("google") ||
    ids.includes("facebook")
  );
}

/**
 * Ensures a `profiles` row exists after Google/Facebook sign-in and maps provider metadata
 * (`name`, `picture`, etc.) into `full_name` / `avatar_url`.
 */
export async function ensureOAuthProfile(user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const derivedName = [meta.full_name, meta.name, user.email?.split("@")[0]].find(
    (x) => typeof x === "string" && x.trim(),
  )?.trim();
  const derivedAvatar = meta.avatar_url ?? meta.picture ?? null;

  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    console.warn("ensureOAuthProfile select:", selErr);
    return;
  }

  if (!existing) {
    const insertRow: Record<string, unknown> = {
      id: user.id,
      full_name: derivedName ?? "Member",
      email: user.email ?? null,
      avatar_url: derivedAvatar,
    };
    const { error: insErr } = await supabase.from("profiles").insert(insertRow);
    if (insErr) {
      const fallback = { id: user.id, full_name: derivedName ?? "Member", email: user.email ?? null };
      const { error: ins2 } = await supabase.from("profiles").insert(fallback);
      if (ins2) console.warn("ensureOAuthProfile insert:", ins2);
    }
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!existing.full_name?.trim() && derivedName) patch.full_name = derivedName;
  if (!existing.avatar_url && derivedAvatar) patch.avatar_url = derivedAvatar;
  if (!existing.email && user.email) patch.email = user.email;

  if (Object.keys(patch).length > 1) {
    const { error: upErr } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (upErr) console.warn("ensureOAuthProfile update:", upErr);
  }
}
