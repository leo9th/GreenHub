import { supabase } from "../../lib/supabase";
import type { BoostTier } from "./boost";

export type VerifyBoostResult = {
  ok?: boolean;
  message?: string;
  boost_expires_at?: string | null;
  error?: string;
};

export async function verifyBoostPayment(
  reference: string,
  productId: number,
  boostTier: BoostTier,
): Promise<VerifyBoostResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { error: "App configuration is incomplete" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: "Sign in required" };
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/verify-boost-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference,
      product_id: productId,
      boost_tier: boostTier,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as VerifyBoostResult & { error?: string };
  if (!res.ok) {
    return { error: json.error || "Verification failed" };
  }
  return json;
}
