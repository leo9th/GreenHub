import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecommendedFallbackProducts, RECOMMENDED_FALLBACK_LIMIT } from "../utils/browseListingQuery";
import type { ProductWithSeller } from "../types/productWithSeller";

type UseFallbackProductsInput = {
  /** True while the primary listing query is in flight. */
  mainLoading: boolean;
  /** Number of products from the main query (0 triggers fallback after idle). */
  mainCount: number;
  /** Optional category bias for shop; omit on home for marketplace-wide picks. */
  categorySlug?: string | null;
};

/**
 * When the main browse result is empty, debounce-fetch popular active listings once per empty spell.
 * Clears when filters change or results return — session cache is this component state only.
 */
export function useFallbackProducts(
  client: SupabaseClient,
  input: UseFallbackProductsInput,
  options?: { debounceMs?: number; limit?: number },
) {
  const debounceMs = options?.debounceMs ?? 300;
  const limit = options?.limit ?? RECOMMENDED_FALLBACK_LIMIT;

  const [fallbackProducts, setFallbackProducts] = useState<ProductWithSeller[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackFetchSettled, setFallbackFetchSettled] = useState(false);

  const { mainLoading, mainCount, categorySlug } = input;

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    if (mainLoading || mainCount > 0) {
      setFallbackProducts([]);
      setFallbackLoading(false);
      setFallbackFetchSettled(false);
      return;
    }

    setFallbackLoading(true);
    setFallbackFetchSettled(false);

    debounceTimer = setTimeout(() => {
      void fetchRecommendedFallbackProducts(client, {
        categorySlug: categorySlug?.trim() || undefined,
        limit,
      }).then(({ rows, error }) => {
        if (cancelled) return;
        setFallbackProducts(error ? [] : rows);
        setFallbackFetchSettled(true);
        setFallbackLoading(false);
      });
    }, debounceMs);

    return () => {
      cancelled = true;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
    };
  }, [client, mainLoading, mainCount, categorySlug, debounceMs, limit]);

  const showFallbackExhaustedHint =
    !mainLoading &&
    mainCount === 0 &&
    !fallbackLoading &&
    fallbackFetchSettled &&
    fallbackProducts.length === 0;

  return {
    fallbackProducts,
    fallbackLoading,
    showFallbackExhaustedHint,
  };
}
