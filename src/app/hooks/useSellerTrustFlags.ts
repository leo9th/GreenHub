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

export type SellerTrustFlags = {
  /** Seller has approved ID verification or profile `is_verified` */
  verifiedSellerIds: Set<string>;
  /** `profiles.verified_badge` when present (e.g. ID, Business, Both) */
  verifiedBadgeBySellerId: Map<string, string>;
};

/**
 * Batch-loads seller trust for listing grids: approved `seller_verification` and/or `profiles.is_verified`.
 */
export function useSellerTrustFlags(
  supabase: SupabaseClient,
  products: Array<Record<string, unknown>>,
): SellerTrustFlags {
  const [flags, setFlags] = useState<SellerTrustFlags>({
    verifiedSellerIds: new Set(),
    verifiedBadgeBySellerId: new Map(),
  });
  const key = useMemo(() => sellerIdsKeyFromProducts(products), [products]);

  useEffect(() => {
    if (!key) {
      setFlags({ verifiedSellerIds: new Set(), verifiedBadgeBySellerId: new Map() });
      return;
    }
    const list = key.split("|").filter(Boolean);
    if (list.length === 0) {
      setFlags({ verifiedSellerIds: new Set(), verifiedBadgeBySellerId: new Map() });
      return;
    }
    let cancelled = false;
    void (async () => {
      const [verRes, profRes] = await Promise.all([
        supabase.from("seller_verification").select("seller_id").eq("status", "approved").in("seller_id", list),
        supabase.from("profiles_public").select("id, is_verified, verified_badge").in("id", list),
      ]);

      if (cancelled) return;

      const approved = new Set<string>();
      if (!verRes.error) {
        for (const row of verRes.data ?? []) {
          const id = (row as { seller_id?: string }).seller_id;
          if (id) approved.add(String(id));
        }
      } else {
        console.warn("[seller_verification] batch:", verRes.error.message);
      }

      const badgeBy = new Map<string, string>();
      const profileVerified = new Set<string>();
      if (!profRes.error) {
        for (const row of profRes.data ?? []) {
          const id = (row as { id?: string }).id;
          if (!id) continue;
          const sid = String(id);
          if ((row as { is_verified?: boolean }).is_verified) profileVerified.add(sid);
          const b = (row as { verified_badge?: string | null }).verified_badge;
          if (typeof b === "string" && b.trim()) badgeBy.set(sid, b.trim());
        }
      } else {
        console.warn("[profiles_public trust] batch:", profRes.error.message);
      }

      const verified = new Set<string>();
      for (const sid of list) {
        if (approved.has(sid) || profileVerified.has(sid)) verified.add(sid);
      }

      setFlags({ verifiedSellerIds: verified, verifiedBadgeBySellerId: badgeBy });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, key]);

  return flags;
}
