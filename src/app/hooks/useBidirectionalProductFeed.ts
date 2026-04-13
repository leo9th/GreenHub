import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProductsListingRpc, mapProductRow, type ListingFilterOpts, type ListingSort } from "../utils/productSearch";
import { getCachedListingBatch, setCachedListingBatch } from "../utils/infiniteScrollCache";

const EDGE_PX = 220;
const SCROLL_DEBOUNCE_MS = 120;

function dedupeById(rows: Array<Record<string, unknown>>, existing: Map<string, Record<string, unknown>>) {
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const id = r.id != null ? String(r.id) : "";
    if (!id || existing.has(id)) continue;
    existing.set(id, r);
    out.push(r);
  }
  return out;
}

export type UseBidirectionalProductFeedOptions = {
  supabase: SupabaseClient;
  pageSize: number;
  searchTerm: string;
  filterOpts: ListingFilterOpts;
  sortBy: ListingSort;
  /** When this string changes, feed resets */
  resetKey: string;
};

export function useBidirectionalProductFeed(opts: UseBidirectionalProductFeedOptions) {
  const { supabase, pageSize, searchTerm, filterOpts, sortBy, resetKey } = opts;

  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState(0);
  const [endOffset, setEndOffset] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingUp, setIsLoadingUp] = useState(false);
  const [isLoadingDown, setIsLoadingDown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingDownRef = useRef(false);
  const loadingUpRef = useRef(false);
  const endOffsetRef = useRef(0);
  const startOffsetRef = useRef(0);
  const totalRef = useRef<number | null>(null);

  useEffect(() => {
    endOffsetRef.current = endOffset;
  }, [endOffset]);
  useEffect(() => {
    startOffsetRef.current = startOffset;
  }, [startOffset]);
  useEffect(() => {
    totalRef.current = totalCount;
  }, [totalCount]);

  const hasMoreUp = startOffset > 0;
  const hasMoreDown = totalCount != null && endOffset < totalCount;

  const resetFeed = useCallback(async () => {
    setIsInitialLoading(true);
    setLoadError(null);
    setProducts([]);
    setStartOffset(0);
    setEndOffset(0);
    setTotalCount(null);

    const cacheKey = `${resetKey}|0`;
    const cached = getCachedListingBatch(cacheKey);
    if (cached) {
      setProducts(cached.rows.map((r) => mapProductRow(r)));
      setTotalCount(cached.total);
      setStartOffset(cached.startOffset);
      setEndOffset(cached.endOffset);
      setIsInitialLoading(false);
      return;
    }

    try {
      const { rows, total, error } = await fetchProductsListingRpc(supabase, {
        searchTerm,
        filterOpts,
        sortBy,
        limit: pageSize,
        offset: 0,
      });
      if (error) throw new Error(error);
      const mapped = rows.map((r) => mapProductRow(r));
      setProducts(mapped);
      setTotalCount(total);
      setStartOffset(0);
      setEndOffset(mapped.length);
      setCachedListingBatch(cacheKey, {
        rows,
        total,
        startOffset: 0,
        endOffset: mapped.length,
      });
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setProducts([]);
      setTotalCount(0);
    } finally {
      setIsInitialLoading(false);
    }
  }, [supabase, pageSize, searchTerm, filterOpts, sortBy, resetKey]);

  useEffect(() => {
    void resetFeed();
  }, [resetFeed]);

  const loadMoreDown = useCallback(async () => {
    const total = totalRef.current;
    const off = endOffsetRef.current;
    if (loadingDownRef.current || total == null || off >= total) return;
    loadingDownRef.current = true;
    setIsLoadingDown(true);
    try {
      const { rows, error } = await fetchProductsListingRpc(supabase, {
        searchTerm,
        filterOpts,
        sortBy,
        limit: pageSize,
        offset: off,
      });
      if (error) throw new Error(error);
      const mapped = rows.map((r) => mapProductRow(r));
      setProducts((prev) => {
        const mapById = new Map(prev.map((p) => [String(p.id), p]));
        const merged = dedupeById(mapped, mapById);
        return [...prev, ...merged];
      });
      setEndOffset((e) => e + rows.length);
    } catch (e: unknown) {
      console.warn("loadMoreDown", e);
    } finally {
      setIsLoadingDown(false);
      loadingDownRef.current = false;
    }
  }, [supabase, searchTerm, filterOpts, sortBy, pageSize]);

  const loadMoreUp = useCallback(async () => {
    const so = startOffsetRef.current;
    if (loadingUpRef.current || so <= 0) return;
    loadingUpRef.current = true;
    setIsLoadingUp(true);
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    const nextStart = Math.max(0, so - pageSize);
    try {
      const { rows, error } = await fetchProductsListingRpc(supabase, {
        searchTerm,
        filterOpts,
        sortBy,
        limit: pageSize,
        offset: nextStart,
      });
      if (error) throw new Error(error);
      const mapped = rows.map((r) => mapProductRow(r));
      setProducts((prev) => {
        const mapById = new Map(prev.map((p) => [String(p.id), p]));
        const merged = dedupeById(mapped, mapById);
        return [...merged, ...prev];
      });
      setStartOffset(nextStart);

      requestAnimationFrame(() => {
        const box = scrollRef.current;
        if (!box) return;
        const delta = box.scrollHeight - prevScrollHeight;
        box.scrollTop = prevScrollTop + delta;
      });
    } catch (e: unknown) {
      console.warn("loadMoreUp", e);
    } finally {
      setIsLoadingUp(false);
      loadingUpRef.current = false;
    }
  }, [supabase, searchTerm, filterOpts, sortBy, pageSize]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const { scrollTop, scrollLeft, clientHeight, clientWidth, scrollHeight, scrollWidth } = el;

      const nearBottom = scrollTop + clientHeight >= scrollHeight - EDGE_PX;
      const nearTop = scrollTop <= EDGE_PX;
      const nearRight = scrollLeft + clientWidth >= scrollWidth - EDGE_PX;
      const nearLeft = scrollLeft <= EDGE_PX;

      if (nearBottom || nearRight) void loadMoreDown();
      if ((nearTop || nearLeft) && hasMoreUp) void loadMoreUp();
    }, SCROLL_DEBOUNCE_MS);
  }, [loadMoreDown, loadMoreUp, hasMoreUp]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const step = 120;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollTop += step;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        el.scrollTop -= step;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        el.scrollLeft += step;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        el.scrollLeft -= step;
      }
    },
    [],
  );

  const cursor = useMemo(
    () => ({
      startOffset,
      endOffset,
      hasMoreUp,
      hasMoreDown,
      hasMoreLeft: hasMoreUp,
      hasMoreRight: hasMoreDown,
    }),
    [startOffset, endOffset, hasMoreUp, hasMoreDown],
  );

  return {
    products,
    setProducts,
    totalCount,
    scrollRef,
    cursor,
    isInitialLoading,
    isLoadingUp,
    isLoadingDown,
    isLoadingLeft: isLoadingUp,
    isLoadingRight: isLoadingDown,
    loadError,
    onScroll,
    onKeyDown,
    reload: resetFeed,
  };
}
