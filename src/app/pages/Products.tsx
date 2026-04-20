import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import { ConditionFilter } from "../components/ConditionFilter";
import MoreFiltersDrawer from "../components/MoreFiltersDrawer";
import { SortBar } from "../components/SortBar";
import { categoryFilterLabelToDbValue } from "../data/catalogConstants";
import { getConditionFilterDropdownOptions } from "../data/productConditions";
import SimpleProductGrid from "../components/SimpleProductGrid";
import SmartSearchBar from "../components/SmartSearchBar";
import type { ProductWithSeller } from "../types/productWithSeller";
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

const LIMIT = 12;

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterSelection>("All");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState("all");
  const [listingSort, setListingSort] = useState<ListingSort>("recent");
  const [moreFilters, setMoreFilters] = useState<BrowseMoreFiltersState>(defaultBrowseMoreFilters);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [moreFiltersDraft, setMoreFiltersDraft] = useState<BrowseMoreFiltersState>(defaultBrowseMoreFilters);
  const [recommendedFallback, setRecommendedFallback] = useState<ProductWithSeller[]>([]);
  const [recommendedFallbackLoading, setRecommendedFallbackLoading] = useState(false);

  const categoryLabel = useMemo(() => {
    if (selectedCategory === "All") return "All Categories";
    return selectedCategory;
  }, [selectedCategory]);

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

  const fetchProducts = async (isNewCategory = false) => {
    const currentPage = isNewCategory ? 0 : page;
    const from = currentPage * LIMIT;
    const to = from + LIMIT - 1;

    if (isNewCategory) {
      setIsLoading(true);
      setProducts([]);
    } else {
      setLoadingMore(true);
    }

    setError(null);

    const searchT = normalizedGlobalSearchTerm(globalSearchTerm);
    let sellerIds: string[] = [];
    if (searchT) {
      sellerIds = await fetchSellerIdsForGlobalSearch(supabase, searchT);
    }

    let query = supabase.from("products").select(productsSelectWithSellerEmbed()).eq("status", "active");

    const categorySlug = categoryFilterLabelToDbValue(selectedCategory);
    if (categorySlug) {
      query = query.eq("category", categorySlug);
    }

    query = applyBrowseProductQueryFilters(query, {
      condition: selectedCondition,
      priceRange,
      sortBy: listingSort,
      more: moreFilters,
      searchTermRaw: globalSearchTerm,
      sellerIds,
    });

    const { data, error: queryError } = await query.range(from, to);

    if (queryError) {
      if (isNewCategory) {
        setProducts([]);
      }
      setHasMore(false);
      setError(queryError.message);
    } else {
      const incoming = (data as ProductWithSeller[]) ?? [];
      setProducts((prev) => (isNewCategory ? incoming : [...prev, ...incoming]));
      setHasMore(incoming.length === LIMIT);
    }

    setIsLoading(false);
    setLoadingMore(false);
  };

  const handleLoadMore = () => {
    if (isLoading || loadingMore || !hasMore) return;
    setPage((prev) => prev + 1);
  };

  useEffect(() => {
    if (page > 0) {
      void fetchProducts();
    }
  }, [page]);

  useEffect(() => {
    setPage(0);
    void fetchProducts(true);
  }, [selectedCategory, selectedCondition, globalSearchTerm, listingSort, priceRange, moreFilters]);

  useEffect(() => {
    if (isLoading || loadingMore) {
      setRecommendedFallback([]);
      setRecommendedFallbackLoading(false);
      return;
    }
    if (products.length > 0) {
      setRecommendedFallback([]);
      return;
    }

    let cancelled = false;
    setRecommendedFallbackLoading(true);
    const slug = categoryFilterLabelToDbValue(selectedCategory);
    void fetchRecommendedFallbackProducts(supabase, {
      categorySlug: slug || undefined,
    }).then(({ rows, error }) => {
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
  }, [isLoading, loadingMore, products.length, selectedCategory]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4">
          <Link
            to="/"
            className="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Home
          </Link>
        </div>

        <CategoryFilter
          key={selectedCategory}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          endSlot={
            <ConditionFilter
              id="shop-condition-filter"
              categorySlug={categorySlugForFilter}
              value={selectedCondition}
              onChange={setSelectedCondition}
              inline
            />
          }
        />

        <div className="mb-4">
          <SmartSearchBar
            inputId="shop-global-search"
            value={globalSearchTerm}
            onChange={setGlobalSearchTerm}
          />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor="shop-price-range" className="text-sm font-medium text-gray-700">
              Price
            </label>
            <select
              id="shop-price-range"
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="min-w-[10rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            >
              {BROWSE_PRICE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <SortBar id="shop-listing-sort" value={listingSort} onChange={setListingSort} />
            <button
              type="button"
              onClick={() => {
                setMoreFiltersDraft({ ...moreFilters });
                setMoreFiltersOpen(true);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              More filters
            </button>
          </div>
        </div>

        <MoreFiltersDrawer
          open={moreFiltersOpen}
          onClose={() => setMoreFiltersOpen(false)}
          idPrefix="shop-more-filters"
          value={moreFiltersDraft}
          onChange={setMoreFiltersDraft}
          onApply={() => {
            setMoreFilters({ ...moreFiltersDraft });
            setMoreFiltersOpen(false);
          }}
          onReset={() => setMoreFiltersDraft(defaultBrowseMoreFilters())}
        />

        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Shop - {categoryLabel}</h1>
          <span className="text-sm text-gray-600">{isLoading ? "Loading..." : `${products.length} products`}</span>
        </div>

        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}
        <SimpleProductGrid
          products={products}
          isLoading={isLoading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
          emptyFallbackTitle="Recommended for you"
          emptyFallbackProducts={recommendedFallback}
          emptyFallbackLoading={recommendedFallbackLoading}
        />
      </div>
    </div>
  );
}
