import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";
import SimpleProductGrid from "../components/SimpleProductGrid";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import { ConditionFilter } from "../components/ConditionFilter";
import { categories, categoryFilterLabelToDbValue } from "../data/catalogConstants";
import { getConditionFilterDropdownOptions } from "../data/productConditions";
import type { ProductWithSeller } from "../types/productWithSeller";
/**
 * GreenHub Home Page - Two-Dimensional Infinite Scroll Architecture
 *
 * VERTICAL DIMENSION: Category rows stack vertically, allowing full-page scroll
 * HORIZONTAL DIMENSION: Each category row scrolls left-to-right with snap alignment
 *
 * State Management:
 * - `rowBySlug`: Dictionary keyed by category slug, each holding a CategoryRowState
 * - `categoryHasMore`: Implicit in CategoryRowState.hasMore for each category
 *
 * Features:
 * - Independent pagination: Each category loads/scrolles independently
 * - Smooth snap alignment: snap-x snap-mandatory ensures cards always land perfectly
 * - Hidden scrollbar: CSS scrollbar-hide class maintains app-like aesthetic
 * - Real-time filtering: CategoryFilter updates visible rows instantly
 * - Product linking: Cards reference products with seller data and images
 */
/** Number of products shown in the main home grid. */
const HOME_PAGE_SIZE = 20;
/** Pull a larger pool so we can shuffle and show a varied mix (PostgREST has no portable `order by random()`). */
const FEATURED_FETCH_LIMIT = 80;

/** Products per horizontal “page” for each category row. */
const ROW_PAGE_SIZE = 10;

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchFeaturedProducts(
  conditionFilter: string,
  sellerSearchTerm: string = "",
): Promise<{ rows: ProductWithSeller[]; error: string | null }> {
  // If seller search is provided, first fetch matching seller IDs
  let sellerIds: string[] | null = null;
  if (sellerSearchTerm.trim()) {
    const searchTerm = sellerSearchTerm.trim().toLowerCase();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
    
    sellerIds = profiles?.map((p) => p.id) || [];
    
    // If no matching sellers, return empty results
    if (sellerIds.length === 0) {
      return { rows: [], error: null };
    }
  }

  let query = supabase
    .from("products")
    .select("*, seller:profiles!products_seller_id_fkey(full_name, avatar_url, rating)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(FEATURED_FETCH_LIMIT);

  if (conditionFilter && conditionFilter !== "all") {
    query = query.eq("condition", conditionFilter);
  }

  // Filter by seller IDs if seller search is active
  if (sellerIds !== null && sellerIds.length > 0) {
    query = query.in("seller_id", sellerIds);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: [], error: error.message };
  }
  const pool = ((data as ProductWithSeller[]) ?? []).filter(Boolean);
  const rows = shuffleArray(pool).slice(0, HOME_PAGE_SIZE);
  return { rows, error: null };
}

type CategoryRowState = {
  products: ProductWithSeller[];
  nextPage: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

const emptyRow = (): CategoryRowState => ({
  products: [],
  nextPage: 0,
  hasMore: true,
  loading: true,
  loadingMore: false,
  error: null,
});

function mapProductToCardProps(product: ProductWithSeller) {
  const seller = product.seller;
  const legacyProfile = product.profiles as { full_name?: string } | null | undefined;
  const sellerName =
    seller && typeof seller.full_name === "string" && seller.full_name.trim() !== ""
      ? seller.full_name.trim()
      : legacyProfile && typeof legacyProfile.full_name === "string" && legacyProfile.full_name.trim() !== ""
        ? legacyProfile.full_name.trim()
        : undefined;

  return {
    key: String(product.id),
    id: String(product.id ?? ""),
    title: String(product.title ?? ""),
    price: Number(product.price_local ?? product.price ?? 0) || 0,
    priceLocal: Number(product.price_local ?? 0) || undefined,
    image: typeof product.image === "string" ? product.image : "",
    images: Array.isArray(product.images) ? (product.images as string[]) : undefined,
    location: typeof product.location === "string" ? product.location : "",
    city: typeof product.city === "string" ? product.city : "",
    state: typeof product.state === "string" ? product.state : "",
    condition: typeof product.condition === "string" ? product.condition : "",
    sellerName,
  };
}

async function fetchCategoryPage(
  categorySlug: string,
  pageIndex: number,
  conditionFilter: string,
  sellerSearchTerm: string = "",
): Promise<{ rows: ProductWithSeller[]; error: string | null }> {
  const from = pageIndex * ROW_PAGE_SIZE;
  const to = from + ROW_PAGE_SIZE - 1;

  // If seller search is provided, first fetch matching seller IDs
  let sellerIds: string[] | null = null;
  if (sellerSearchTerm.trim()) {
    const searchTerm = sellerSearchTerm.trim().toLowerCase();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
    
    sellerIds = profiles?.map((p) => p.id) || [];
    
    // If no matching sellers, return empty results
    if (sellerIds.length === 0) {
      return { rows: [], error: null };
    }
  }

  let query = supabase
    .from("products")
    .select("*, seller:profiles!products_seller_id_fkey(full_name, avatar_url, rating)")
    .eq("status", "active")
    .eq("category", categorySlug)
    .order("created_at", { ascending: false });

  if (conditionFilter && conditionFilter !== "all") {
    query = query.eq("condition", conditionFilter);
  }

  // Filter by seller IDs if seller search is active
  if (sellerIds !== null && sellerIds.length > 0) {
    query = query.in("seller_id", sellerIds);
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: ((data as ProductWithSeller[]) ?? []).filter(Boolean), error: null };
}

type CategoryRowProps = {
  slug: string;
  title: string;
  row: CategoryRowState;
  onLoadMore: (slug: string) => void;
};

function CategoryRow({ slug, title, row, onLoadMore }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !row.hasMore || row.loading || row.loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) onLoadMore(slug);
      },
      { root, rootMargin: "120px", threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [slug, row.hasMore, row.loading, row.loadingMore, row.products.length, onLoadMore]);

  return (
    <section className="mb-8" aria-labelledby={`home-row-${slug}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2 px-0.5">
        <h2 id={`home-row-${slug}`} className="text-base font-semibold text-gray-900 sm:text-lg">
          {title}
        </h2>
        <Link to="/products" className="shrink-0 text-xs font-medium text-[#16a34a] hover:underline sm:text-sm">
          See all
        </Link>
      </div>

      {row.error ? (
        <p className="mb-2 text-sm text-amber-700">{row.error}</p>
      ) : null}

      <div
        ref={scrollRef}
        className="-mx-1 flex gap-3 overflow-x-auto overflow-y-hidden px-1 pb-2 snap-x snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]"
      >
        {row.loading && row.products.length === 0 ? (
          <div className="flex gap-3 py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`sk-${slug}-${i}`}
                className="h-[280px] w-[160px] shrink-0 snap-start animate-pulse rounded-2xl bg-gray-200"
              />
            ))}
          </div>
        ) : null}

        {!row.loading && row.products.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No products in this category yet.</p>
        ) : null}

        {row.products.map((product) => {
          const p = mapProductToCardProps(product);
          return (
            <div key={p.key} className="w-[160px] shrink-0 snap-start sm:w-[180px]">
              <ProductCard
                id={p.id}
                title={p.title}
                price={p.price}
                priceLocal={p.priceLocal}
                image={p.image}
                images={p.images}
                location={p.location}
                city={p.city}
                state={p.state}
                condition={p.condition}
                sellerName={p.sellerName}
              />
            </div>
          );
        })}

        {row.hasMore ? (
          <div
            ref={sentinelRef}
            className="flex w-[160px] shrink-0 snap-start items-center justify-center self-stretch sm:w-[180px]"
          >
            {row.loadingMore ? (
              <span className="text-xs text-gray-500">Loading…</span>
            ) : (
              <button
                type="button"
                onClick={() => onLoadMore(slug)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-transform"
              >
                Load more
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterSelection>("All");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [sellerSearchTerm, setSellerSearchTerm] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState<ProductWithSeller[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [rowBySlug, setRowBySlug] = useState<Record<string, CategoryRowState>>({});

  const categorySlugForFilter = useMemo(
    () => categoryFilterLabelToDbValue(selectedCategory),
    [selectedCategory],
  );

  useEffect(() => {
    const opts = getConditionFilterDropdownOptions(categorySlugForFilter);
    setSelectedCondition((prev) => {
      if (prev === "all") return prev;
      return opts.includes(prev) ? prev : "all";
    });
  }, [categorySlugForFilter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setFeaturedLoading(true);
      setFeaturedError(null);
      const { rows, error } = await fetchFeaturedProducts(selectedCondition, sellerSearchTerm);
      if (cancelled) return;
      if (error) {
        setFeaturedError(error);
        setFeaturedProducts([]);
      } else {
        setFeaturedProducts(rows);
      }
      setFeaturedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCondition, sellerSearchTerm]);

  const slugsToShow = useMemo(() => {
    if (selectedCategory === "All") {
      return categories.map((c) => c.id);
    }
    const one = categoryFilterLabelToDbValue(selectedCategory);
    return one ? [one] : [];
  }, [selectedCategory]);

  const loadPageForSlug = useCallback(async (
    categorySlug: string,
    pageIndex: number,
    append: boolean,
    conditionFilter: string,
    sellerSearch: string = "",
  ) => {
    const { rows, error } = await fetchCategoryPage(categorySlug, pageIndex, conditionFilter, sellerSearch);
    setRowBySlug((prev) => {
      const base = prev[categorySlug] ?? emptyRow();
      if (error) {
        return {
          ...prev,
          [categorySlug]: {
            ...base,
            loading: false,
            loadingMore: false,
            error,
            hasMore: false,
          },
        };
      }
      const merged = append ? [...base.products, ...rows] : rows;
      return {
        ...prev,
        [categorySlug]: {
          products: merged,
          nextPage: pageIndex + 1,
          hasMore: rows.length === ROW_PAGE_SIZE,
          loading: false,
          loadingMore: false,
          error: null,
        },
      };
    });
  }, []);

  const handleLoadMoreRow = useCallback(
    (slug: string) => {
      let next: { page: number } | null = null;
      setRowBySlug((prev) => {
        const r = prev[slug];
        if (!r || !r.hasMore || r.loading || r.loadingMore) return prev;
        next = { page: r.nextPage };
        return { ...prev, [slug]: { ...r, loadingMore: true } };
      });
      if (next) void loadPageForSlug(slug, next.page, true, selectedCondition, sellerSearchTerm);
    },
    [loadPageForSlug, selectedCondition, sellerSearchTerm],
  );

  useEffect(() => {
    const slugs = slugsToShow;
    if (slugs.length === 0) {
      setRowBySlug({});
      return;
    }

    setRowBySlug(() => {
      const initial: Record<string, CategoryRowState> = {};
      for (const s of slugs) {
        initial[s] = emptyRow();
      }
      return initial;
    });

    void (async () => {
      await Promise.all(slugs.map((slug) => loadPageForSlug(slug, 0, false, selectedCondition, sellerSearchTerm)));
    })();
  }, [slugsToShow, loadPageForSlug, selectedCondition, sellerSearchTerm]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Featured Products</h1>
          <Link to="/products" className="text-sm font-medium text-[#16a34a] hover:underline">
            Go to Shop
          </Link>
        </div>

        <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />

        <ConditionFilter
          id="home-condition-filter"
          categorySlug={categorySlugForFilter}
          value={selectedCondition}
          onChange={setSelectedCondition}
        />

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by seller name or @username"
              value={sellerSearchTerm}
              onChange={(e) => setSellerSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-500 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            />
          </div>
        </div>

        {featuredError ? <p className="mb-4 text-sm text-amber-700">{featuredError}</p> : null}

        <div className="mb-10">
          <SimpleProductGrid
            products={featuredProducts}
            isLoading={featuredLoading}
            hasMore={false}
            loadingMore={false}
            onLoadMore={() => {}}
          />
        </div>

        <h2 className="mb-3 text-base font-semibold text-gray-900 sm:text-lg">Browse by category</h2>

        <div className="space-y-2">
          {slugsToShow.map((slug) => {
            const meta = categories.find((c) => c.id === slug);
            const rowTitle = meta?.name ?? slug;
            const row = rowBySlug[slug] ?? emptyRow();
            return (
              <CategoryRow
                key={slug}
                slug={slug}
                title={rowTitle}
                row={row}
                onLoadMore={handleLoadMoreRow}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
