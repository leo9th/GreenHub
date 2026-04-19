import { useCallback, useState } from "react";
import { supabase } from "../../lib/supabase";
import { activeProductsQuery, mapProductRow } from "../utils/productSearch";

/**
 * Placeholder for collaborative / content-based recommendations.
 * Extend with purchase history, likes, and `user_activity` when wired.
 */
export function useAIRecommendations(userId: string | null) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await activeProductsQuery(supabase).limit(12);
      if (error) throw error;
      setRows((data ?? []).map((r) => mapProductRow(r as Record<string, unknown>)));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { recommendations: rows, loading, refresh };
}
