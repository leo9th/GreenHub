import { supabase } from "../../lib/supabase";
import type { BoostTier } from "./boost";

export type ApplyComplimentaryBoostResult = {
  ok?: boolean;
  boost_expires_at?: string | null;
  error?: string;
};

export async function applyComplimentaryAdsBoost(
  productId: number,
  boostTier: BoostTier,
): Promise<ApplyComplimentaryBoostResult> {
  const { data, error } = await supabase.rpc("apply_complimentary_ads_boost", {
    p_product_id: productId,
    p_tier: boostTier,
  });

  if (error) {
    return { error: error.message || "Could not apply boost" };
  }

  const row = data as { ok?: boolean; boost_expires_at?: string | null } | null;
  if (row && row.ok === true) {
    return { ok: true, boost_expires_at: row.boost_expires_at ?? null };
  }
  return { error: "Unexpected response" };
}
