import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

function sellerIdsKeyFromProducts(products: Array<Record<string, unknown>>): string {
  const ids = new Set<string>();
  for (const p of products) {
    const sid = p.seller_id ?? p.sellerId;
    if (sid != null && String(sid).trim() !== "") ids.add(String(sid));
  }
  return [...ids].sort().join("|");
}

/**
 * Loads approved seller IDs for the given product rows (batch).
 */
export function useVerifiedSellerIds(
  supabase: SupabaseClient,
  products: Array<Record<string, unknown>>,
): Set<string> {
  const [verified, setVerified] = useState<Set<string>>(() => new Set());
  const key = useMemo(() => sellerIdsKeyFromProducts(products), [products]);

  useEffect(() => {
    if (!key) {
      setVerified(new Set());
      return;
    }
    const list = key.split("|").filter(Boolean);
    if (list.length === 0) {
      setVerified(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("seller_verification").select("seller_id").in("seller_id", list);
      if (cancelled) return;
      if (error) {
        console.warn("[seller_verification] batch:", error.message);
        setVerified(new Set());
        return;
      }
      const next = new Set<string>();
      for (const row of data ?? []) {
        const id = (row as { seller_id?: string }).seller_id;
        if (id) next.add(String(id));
      }
      setVerified(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, key]);

  return verified;
}
