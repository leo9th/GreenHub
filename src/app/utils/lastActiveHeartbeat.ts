import type { SupabaseClient } from "@supabase/supabase-js";

let lastPing = 0;
const MIN_MS = 45_000;

/** Call on navigation / focus; throttled RPC to update profiles.last_active. */
export function pingLastActiveThrottled(supabase: SupabaseClient): void {
  const now = Date.now();
  if (now - lastPing < MIN_MS) return;
  lastPing = now;
  void supabase.rpc("update_last_active").then(({ error }) => {
    if (error) lastPing = 0;
  });
}
