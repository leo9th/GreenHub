import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fetchProductLikeCount,
  fetchUserLikesProduct,
  normalizeProductPk,
  subscribeToProductLikes,
  toggleProductLike,
  type ProductPk,
} from "../utils/engagement";

type UseProductLikeOptions = {
  productId?: ProductPk | null;
  initialLikeCount?: number;
  userId?: string | null;
  onAuthRequired?: () => void;
  onError?: (message: string) => void;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function useProductLike({
  productId,
  initialLikeCount = 0,
  userId,
  onAuthRequired,
  onError,
}: UseProductLikeOptions) {
  const normalizedProductId = useMemo(() => normalizeProductPk(productId), [productId]);
  const safeInitialLikeCount =
    typeof initialLikeCount === "number" && Number.isFinite(initialLikeCount)
      ? Math.max(0, initialLikeCount)
      : 0;

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeCount, setLikeCount] = useState(safeInitialLikeCount);

  useEffect(() => {
    setLikeCount(safeInitialLikeCount);
  }, [safeInitialLikeCount, normalizedProductId]);

  useEffect(() => {
    const pid = normalizedProductId;
    if (!pid) return;
    let cancelled = false;
    void fetchProductLikeCount(supabase, pid).then((count) => {
      if (!cancelled) setLikeCount(Math.max(0, count));
    });
    return () => {
      cancelled = true;
    };
  }, [normalizedProductId]);

  useEffect(() => {
    const pid = normalizedProductId;
    if (!pid || !userId) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    void fetchUserLikesProduct(supabase, pid, userId).then((isLiked) => {
      if (!cancelled) setLiked(isLiked);
    });
    return () => {
      cancelled = true;
    };
  }, [normalizedProductId, userId]);

  useEffect(() => {
    const pid = normalizedProductId;
    if (!pid) return;
    const channel = subscribeToProductLikes(supabase, pid, (count) => {
      setLikeCount(Math.max(0, count));
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [normalizedProductId]);

  const toggleLike = useCallback(async () => {
    const pid = normalizedProductId;
    if (!pid || likeBusy) return;
    if (!userId) {
      onAuthRequired?.();
      return;
    }

    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;

    console.debug("[useProductLike] toggle start", {
      productId: pid,
      userId,
      previousLiked,
      nextLiked,
    });

    setLikeBusy(true);
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));

    try {
      const result = await toggleProductLike(supabase, pid, userId, previousLiked);
      if (result.error) throw new Error(result.error);
      const syncedCount = await fetchProductLikeCount(supabase, pid);
      setLikeCount(Math.max(0, syncedCount));
      console.debug("[useProductLike] toggle ok", { productId: pid, syncedCount });
    } catch (error: unknown) {
      console.debug("[useProductLike] toggle error", error);
      setLiked(previousLiked);
      setLikeCount(previousCount);
      onError?.(toErrorMessage(error, "Could not update like"));
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, likeCount, liked, normalizedProductId, onAuthRequired, onError, userId]);

  return {
    liked,
    likeBusy,
    likeCount,
    canLike: Boolean(normalizedProductId),
    setLikeCount,
    toggleLike,
  };
}
