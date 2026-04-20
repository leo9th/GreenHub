import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";
import SimpleProductGrid from "../components/SimpleProductGrid";
import SmartSearchBar from "../components/SmartSearchBar";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import { ConditionFilter } from "../components/ConditionFilter";
import { categories, categoryFilterLabelToDbValue } from "../data/catalogConstants";
import { getConditionFilterDropdownOptions } from "../data/productConditions";
import type { ProductWithSeller } from "../types/productWithSeller";
import { SortBar } from "../components/SortBar";
import CollapsibleFilters from "../components/CollapsibleFilters";
import { useMoreFiltersScrollSync } from "../hooks/useMoreFiltersScrollSync";
import {
  applyBrowseProductQueryFilters,
  BROWSE_PRICE_RANGE_OPTIONS,
  defaultBrowseMoreFilters,
  fetchRecommendedFallbackProducts,
  type BrowseMoreFiltersState,
} from "../utils/browseListingQuery";
import type { ListingSort } from "../utils/productSearch";
import {
  fetchSellerIdsForGlobalSearch,
  normalizedGlobalSearchTerm,
  productsSelectWithSellerEmbed,
} from "../utils/productSearch";
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
/** Pool size for shuffle before slicing to `HOME_PAGE_SIZE` (keep query ≤ ~30 rows for mobile). */
const FEATURED_FETCH_LIMIT = 30;

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
  globalSearchTerm: string = "",
  sortBy: ListingSort = "recent",
  priceRange: string = "all",
  more: BrowseMoreFiltersState = defaultBrowseMoreFilters(),
): Promise<{ rows: ProductWithSeller[]; error: string | null }> {
  const searchT = normalizedGlobalSearchTerm(globalSearchTerm);
  let sellerIds: string[] = [];
  if (searchT) {
    sellerIds = await fetchSellerIdsForGlobalSearch(supabase, searchT);
  }

  let query = supabase.from("products").select(productsSelectWithSellerEmbed()).eq("status", "active");

  query = applyBrowseProductQueryFilters(query, {
    condition: conditionFilter,
    priceRange,
    sortBy,
    more,
    searchTermRaw: globalSearchTerm,
    sellerIds,
  });

  query = query.limit(FEATURED_FETCH_LIMIT);

  const { data, error } = await query;

  if (error) {
    return { rows: [], error: error.message };
  }
  const pool = ((data as ProductWithSeller[]) ?? []).filter(Boolean);
  const rows =
    sortBy === "recent"
      ? shuffleArray(pool).slice(0, HOME_PAGE_SIZE)
      : pool.slice(0, HOME_PAGE_SIZE);
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
    condition: typeof product.condition === "string" ? product.condition : "",
    sellerName,
    sellerVerified: seller?.phone_verified === true,
  };
}

async function fetchCategoryPage(
  categorySlug: string,
  pageIndex: number,
  conditionFilter: string,
  globalSearchTerm: string = "",
  sortBy: ListingSort = "recent",
  priceRange: string = "all",
  more: BrowseMoreFiltersState = defaultBrowseMoreFilters(),
): Promise<{ rows: ProductWithSeller[]; error: string | null }> {
  const from = pageIndex * ROW_PAGE_SIZE;
  const to = from + ROW_PAGE_SIZE - 1;

  const searchT = normalizedGlobalSearchTerm(globalSearchTerm);
  let sellerIds: string[] = [];
  if (searchT) {
    sellerIds = await fetchSellerIdsForGlobalSearch(supabase, searchT);
  }

  let query = supabase
    .from("products")
    .select(productsSelectWithSellerEmbed())
    .eq("status", "active")
    .eq("category", categorySlug);

  query = applyBrowseProductQueryFilters(query, {
    condition: conditionFilter,
    priceRange,
    sortBy,
    more,
    searchTermRaw: globalSearchTerm,
    sellerIds,
  });

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

        {row.products.map((product, idx) => {
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
                condition={p.condition}
                sellerName={p.sellerName}
                sellerVerified={p.sellerVerified}
                imagePriority={idx < 4}
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
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState<ProductWithSeller[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [rowBySlug, setRowBySlug] = useState<Record<string, CategoryRowState>>({});
  const [priceRange, setPriceRange] = useState("all");
  const [listingSort, setListingSort] = useState<ListingSort>("recent");
  const [moreFilters, setMoreFilters] = useState<BrowseMoreFiltersState>(defaultBrowseMoreFilters);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  useMoreFiltersScrollSync(setMoreFiltersOpen);
  const [recommendedFallback, setRecommendedFallback] = useState<ProductWithSeller[]>([]);
  const [recommendedFallbackLoading, setRecommendedFallbackLoading] = useState(false);

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
      const { rows, error } = await fetchFeaturedProducts(
        selectedCondition,
        globalSearchTerm,
        listingSort,
        priceRange,
        moreFilters,
      );
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
  }, [selectedCondition, globalSearchTerm, listingSort, priceRange, moreFilters]);

  useEffect(() => {
    if (featuredLoading) {
      setRecommendedFallback([]);
      setRecommendedFallbackLoading(false);
      return;
    }
    if (featuredProducts.length > 0) {
      setRecommendedFallback([]);
      return;
    }

    let cancelled = false;
    setRecommendedFallbackLoading(true);
    void fetchRecommendedFallbackProducts(supabase).then(({ rows, error }) => {
      if (cancelled) return;
      if (!error) {
        setRecommendedFallback(rows);
      } else {
        setRecommendedFallback([]);
      }
      setRecommendedFallbackLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [featuredLoading, featuredProducts.length]);

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
    globalSearch: string = "",
  ) => {
    const { rows, error } = await fetchCategoryPage(
      categorySlug,
      pageIndex,
      conditionFilter,
      globalSearch,
      listingSort,
      priceRange,
      moreFilters,
    );
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
  }, [listingSort, priceRange, moreFilters]);

  const handleLoadMoreRow = useCallback(
    (slug: string) => {
      let next: { page: number } | null = null;
      setRowBySlug((prev) => {
        const r = prev[slug];
        if (!r || !r.hasMore || r.loading || r.loadingMore) return prev;
        next = { page: r.nextPage };
        return { ...prev, [slug]: { ...r, loadingMore: true } };
      });
      if (next) void loadPageForSlug(slug, next.page, true, selectedCondition, globalSearchTerm);
    },
    [loadPageForSlug, selectedCondition, globalSearchTerm],
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
      await Promise.all(slugs.map((slug) => loadPageForSlug(slug, 0, false, selectedCondition, globalSearchTerm)));
    })();
  }, [slugsToShow, loadPageForSlug, selectedCondition, globalSearchTerm, listingSort, priceRange, moreFilters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Featured Products</h1>
          <Link to="/products" className="text-sm font-medium text-[#16a34a] hover:underline">
            Go to Shop
          </Link>
        </div>

        <CategoryFilter
          key={selectedCategory}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        <div className="mb-4">
          <SmartSearchBar
            inputId="home-global-search"
            value={globalSearchTerm}
            onChange={setGlobalSearchTerm}
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <SortBar id="home-listing-sort" value={listingSort} onChange={setListingSort} />
        </div>

        <CollapsibleFilters
          idPrefix="home-collapsible-filters"
          isOpen={moreFiltersOpen}
          onOpenChange={setMoreFiltersOpen}
          className="mb-4"
        >
          <ConditionFilter
            id="home-condition-filter"
            categorySlug={categorySlugForFilter}
            value={selectedCondition}
            onChange={setSelectedCondition}
          />
          <div>
            <label htmlFor="home-price-range" className="mb-1 block text-sm font-medium text-gray-700">
              Price range
            </label>
            <select
              id="home-price-range"
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            >
              {BROWSE_PRICE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="home-more-location" className="block text-sm font-medium text-gray-700">
              Location (city / area)
            </label>
            <p className="mb-1 text-xs text-gray-500">Matches text in the listing location field.</p>
            <input
              id="home-more-location"
              type="text"
              value={moreFilters.locationContains}
              onChange={(e) => setMoreFilters({ ...moreFilters, locationContains: e.target.value })}
              placeholder="e.g. Lagos, Ikeja"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="home-more-brand" className="block text-sm font-medium text-gray-700">
              Brand
            </label>
            <p className="mb-1 text-xs text-gray-500">Partial match on vehicle brand when listed.</p>
            <input
              id="home-more-brand"
              type="text"
              value={moreFilters.brandContains}
              onChange={(e) => setMoreFilters({ ...moreFilters, brandContains: e.target.value })}
              placeholder="e.g. Toyota"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="home-more-delivery" className="block text-sm font-medium text-gray-700">
              Delivery
            </label>
            <select
              id="home-more-delivery"
              value={moreFilters.deliveryMode}
              onChange={(e) =>
                setMoreFilters({
                  ...moreFilters,
                  deliveryMode: e.target.value === "has_options" ? "has_options" : "all",
                })
              }
              className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            >
              <option value="all">Any</option>
              <option value="has_options">Has delivery options listed</option>
            </select>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCondition("all");
                setPriceRange("all");
                setMoreFilters(defaultBrowseMoreFilters());
              }}
              className="text-sm font-medium text-[#16a34a] underline hover:no-underline"
            >
              Reset secondary filters
            </button>
          </div>
        </CollapsibleFilters>

        {featuredError ? <p className="mb-4 text-sm text-amber-700">{featuredError}</p> : null}

        <div className="mb-10">
          <SimpleProductGrid
            products={featuredProducts}
            isLoading={featuredLoading}
            hasMore={false}
            loadingMore={false}
            onLoadMore={() => {}}
            emptyFallbackTitle="Trending now"
            emptyFallbackProducts={recommendedFallback}
            emptyFallbackLoading={recommendedFallbackLoading}
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
