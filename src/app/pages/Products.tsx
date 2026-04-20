import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import { ConditionFilter } from "../components/ConditionFilter";
import CollapsibleFilters from "../components/CollapsibleFilters";
import FloatingFiltersButton from "../components/FloatingFiltersButton";
import { useMoreFiltersScrollSync } from "../hooks/useMoreFiltersScrollSync";
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
  useMoreFiltersScrollSync(setMoreFiltersOpen);
  const openMoreFilters = useCallback(() => {
    setMoreFiltersOpen(true);
  }, []);
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
        />

        <div className="mb-4">
          <SmartSearchBar
            inputId="shop-global-search"
            value={globalSearchTerm}
            onChange={setGlobalSearchTerm}
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <SortBar id="shop-listing-sort" value={listingSort} onChange={setListingSort} />
        </div>

        <CollapsibleFilters
          idPrefix="shop-collapsible-filters"
          sectionId="more-filters-section"
          isOpen={moreFiltersOpen}
          onOpenChange={setMoreFiltersOpen}
          className="mb-4"
        >
          <ConditionFilter
            id="shop-condition-filter"
            categorySlug={categorySlugForFilter}
            value={selectedCondition}
            onChange={setSelectedCondition}
          />
          <div>
            <label htmlFor="shop-price-range" className="mb-1 block text-sm font-medium text-gray-700">
              Price range
            </label>
            <select
              id="shop-price-range"
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
            <label htmlFor="shop-more-location" className="block text-sm font-medium text-gray-700">
              Location (city / area)
            </label>
            <p className="mb-1 text-xs text-gray-500">Matches text in the listing location field.</p>
            <input
              id="shop-more-location"
              type="text"
              value={moreFilters.locationContains}
              onChange={(e) => setMoreFilters({ ...moreFilters, locationContains: e.target.value })}
              placeholder="e.g. Lagos, Ikeja"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="shop-more-brand" className="block text-sm font-medium text-gray-700">
              Brand
            </label>
            <p className="mb-1 text-xs text-gray-500">Partial match on vehicle brand when listed.</p>
            <input
              id="shop-more-brand"
              type="text"
              value={moreFilters.brandContains}
              onChange={(e) => setMoreFilters({ ...moreFilters, brandContains: e.target.value })}
              placeholder="e.g. Toyota"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="shop-more-delivery" className="block text-sm font-medium text-gray-700">
              Delivery
            </label>
            <select
              id="shop-more-delivery"
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

      <FloatingFiltersButton visible={!moreFiltersOpen} onOpen={openMoreFilters} />
    </div>
  );
}
