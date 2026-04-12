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
 * Batch-loads seller UUIDs that have paid boost history (`profiles.is_verified_advertiser`).
 */
export function useVerifiedAdvertiserIds(
  supabase: SupabaseClient,
  products: Array<Record<string, unknown>>,
): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const key = useMemo(() => sellerIdsKeyFromProducts(products), [products]);

  useEffect(() => {
    if (!key) {
      setIds(new Set());
      return;
    }
    const list = key.split("|").filter(Boolean);
    if (list.length === 0) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles_public")
        .select("id, is_verified_advertiser")
        .in("id", list)
        .eq("is_verified_advertiser", true);
      if (cancelled) return;
      if (error) {
        if (!String(error.message ?? "").toLowerCase().includes("column")) {
          console.warn("[profiles_public is_verified_advertiser] batch:", error.message);
        }
        setIds(new Set());
        return;
      }
      const next = new Set<string>();
      for (const row of data ?? []) {
        const id = (row as { id?: string }).id;
        if (id) next.add(String(id));
      }
      setIds(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, key]);

  return ids;
}
