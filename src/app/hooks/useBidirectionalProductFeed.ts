import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProductsListingRpc, mapProductRow, type ListingFilterOpts, type ListingSort } from "../utils/productSearch";
import { getCachedListingBatch, setCachedListingBatch } from "../utils/infiniteScrollCache";

const BOTTOM_EDGE_PX = 200;
const SCROLL_DEBOUNCE_MS = 120;
/** Ignore sub-pixel scrollbar / rounding differences */
const OVERFLOW_SLACK_PX = 2;

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
  /**
   * `window` — page scroll (e.g. Home). `element` — scrollable container ref (e.g. Products grid).
   */
  scrollRoot?: "window" | "element";
};

export function useBidirectionalProductFeed(opts: UseBidirectionalProductFeedOptions) {
  const { supabase, pageSize, searchTerm, filterOpts, sortBy, resetKey, scrollRoot = "element" } = opts;
  const isWindowScroll = scrollRoot === "window";

  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [endOffset, setEndOffset] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingDown, setIsLoadingDown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingDownRef = useRef(false);
  const isInitialLoadingRef = useRef(true);
  const endOffsetRef = useRef(0);
  const totalRef = useRef<number | null>(null);

  useEffect(() => {
    endOffsetRef.current = endOffset;
  }, [endOffset]);
  useEffect(() => {
    totalRef.current = totalCount;
  }, [totalCount]);
  useEffect(() => {
    isInitialLoadingRef.current = isInitialLoading;
  }, [isInitialLoading]);

  const hasMoreDown = totalCount != null && endOffset < totalCount;

  const resetFeed = useCallback(async () => {
    setIsInitialLoading(true);
    setLoadError(null);
    setProducts([]);
    setEndOffset(0);
    setTotalCount(null);

    const cacheKey = `${resetKey}|0`;
    const cached = getCachedListingBatch(cacheKey);
    if (cached) {
      setProducts(cached.rows.map((r) => mapProductRow(r)));
      setTotalCount(cached.total);
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

  const runEdgeCheck = useCallback(() => {
    if (isInitialLoadingRef.current) return;

    let scrollTop: number;
    let clientHeight: number;
    let scrollHeight: number;

    if (isWindowScroll) {
      scrollTop = window.scrollY;
      clientHeight = window.innerHeight;
      scrollHeight = document.documentElement.scrollHeight;
    } else {
      const el = scrollRef.current;
      if (!el) return;
      scrollTop = el.scrollTop;
      clientHeight = el.clientHeight;
      scrollHeight = el.scrollHeight;
    }

    const verticalOverflow = scrollHeight > clientHeight + OVERFLOW_SLACK_PX;
    const total = totalRef.current;
    const end = endOffsetRef.current;

    const nearBottom = verticalOverflow && scrollTop + clientHeight >= scrollHeight - BOTTOM_EDGE_PX;
    const needsMoreToFillViewport =
      !verticalOverflow && total != null && end < total && !loadingDownRef.current;

    if ((nearBottom || needsMoreToFillViewport) && !loadingDownRef.current) {
      void loadMoreDown();
    }
  }, [isWindowScroll, loadMoreDown]);

  const scheduleEdgeCheck = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      runEdgeCheck();
    }, SCROLL_DEBOUNCE_MS);
  }, [runEdgeCheck]);

  const onScroll = useCallback(() => {
    if (isWindowScroll) return;
    scheduleEdgeCheck();
  }, [isWindowScroll, scheduleEdgeCheck]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isWindowScroll) return;
    const onWin = () => scheduleEdgeCheck();
    window.addEventListener("scroll", onWin, { passive: true });
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin);
      window.removeEventListener("resize", onWin);
    };
  }, [isWindowScroll, scheduleEdgeCheck]);

  useLayoutEffect(() => {
    if (isInitialLoading) return;
    runEdgeCheck();
  }, [isInitialLoading, products.length, totalCount, endOffset, resetKey, runEdgeCheck]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined" || isWindowScroll) return;
    const ro = new ResizeObserver(() => {
      runEdgeCheck();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [runEdgeCheck, isWindowScroll, products.length]);

  useEffect(() => {
    if (!isWindowScroll || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => scheduleEdgeCheck());
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [isWindowScroll, scheduleEdgeCheck]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isWindowScroll) return;
      const el = scrollRef.current;
      if (!el) return;
      const step = 120;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollTop += step;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        el.scrollTop -= step;
      }
    },
    [isWindowScroll],
  );

  const cursor = useMemo(
    () => ({
      startOffset: 0,
      endOffset,
      hasMoreUp: false,
      hasMoreDown,
      hasMoreLeft: false,
      hasMoreRight: false,
    }),
    [endOffset, hasMoreDown],
  );

  return {
    products,
    setProducts,
    totalCount,
    scrollRef,
    cursor,
    isInitialLoading,
    isLoadingUp: false,
    isLoadingDown,
    isLoadingLeft: false,
    isLoadingRight: false,
    loadError,
    onScroll,
    onKeyDown,
    reload: resetFeed,
    runEdgeCheck,
    scrollRoot,
  };
}
