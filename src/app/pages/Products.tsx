import { useState, useEffect, useLayoutEffect, useMemo, useCallback, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Filter, ArrowLeft, X, BadgeCheck, Star } from "lucide-react";
import { categories, nigerianStates } from "../data/mockData";
import { labelForCarBrandValue, NIGERIA_CAR_BRAND_OPTIONS } from "../data/carBrands";
import { useCurrency } from "../hooks/useCurrency";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";
import { getFeaturedProductIds, mixFeaturedProducts } from "../utils/featureProductMix";
import {
  applyListingFilters,
  applyListingSort,
  listingBaseQuery,
  mapProductRow,
  PRODUCTS_PAGE_SIZE,
  sanitizeSearchTerm,
  type ListingFilterOpts,
  type ListingSort,
  withSearchOr,
} from "../utils/productSearch";

const conditions = ["New", "Like New", "Good Fair"];
const priceRanges = [
  { label: "Under ₦10,000", value: "0-10000" },
  { label: "₦10,000 - ₦50,000", value: "10000-50000" },
  { label: "₦50,000 - ₦100,000", value: "50000-100000" },
  { label: "₦100,000 - ₦500,000", value: "100000-500000" },
  { label: "Above ₦500,000", value: "500000-999999999" },
];

function ProductsFilterFields({
  selectedCategory,
  handleCategoryChange,
  selectedCarBrand,
  handleCarBrandChange,
  selectedCondition,
  setSelectedCondition,
  priceRange,
  setPriceRange,
  selectedState,
  setSelectedState,
}: {
  selectedCategory: string;
  handleCategoryChange: (val: string) => void;
  selectedCarBrand: string;
  handleCarBrandChange: (val: string) => void;
  selectedCondition: string;
  setSelectedCondition: (v: string) => void;
  priceRange: string;
  setPriceRange: (v: string) => void;
  selectedState: string;
  setSelectedState: (v: string) => void;
}): ReactNode {
  return (
    <>
      <div>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Category</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="category-sidebar"
              checked={selectedCategory === "all"}
              onChange={() => handleCategoryChange("all")}
              className="text-[#22c55e] focus:ring-[#22c55e]"
            />
            <span className="text-sm text-gray-700">All Categories</span>
          </label>
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category-sidebar"
                checked={selectedCategory === category.id}
                onChange={() => handleCategoryChange(category.id)}
                className="text-[#22c55e] focus:ring-[#22c55e]"
              />
              <span className="text-sm text-gray-700">
                {category.emoji} {category.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {selectedCategory === "vehicles" && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Car brand</h3>
          <select
            value={selectedCarBrand}
            onChange={(e) => handleCarBrandChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          >
            <option value="all">All brands</option>
            {NIGERIA_CAR_BRAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Custom brands (typed as “Other” on listings) won’t match a preset—use search by name.
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Condition</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="condition-sidebar"
              checked={selectedCondition === "all"}
              onChange={() => setSelectedCondition("all")}
              className="text-[#22c55e] focus:ring-[#22c55e]"
            />
            <span className="text-sm text-gray-700">All Conditions</span>
          </label>
          {conditions.map((c) => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="condition-sidebar"
                checked={selectedCondition === c}
                onChange={() => setSelectedCondition(c)}
                className="text-[#22c55e] focus:ring-[#22c55e]"
              />
              <span className="text-sm text-gray-700">{c}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Price range</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="price-sidebar"
              checked={priceRange === "all"}
              onChange={() => setPriceRange("all")}
              className="text-[#22c55e] focus:ring-[#22c55e]"
            />
            <span className="text-sm text-gray-700">All Prices</span>
          </label>
          {priceRanges.map((range) => (
            <label key={range.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="price-sidebar"
                checked={priceRange === range.value}
                onChange={() => setPriceRange(range.value)}
                className="text-[#22c55e] focus:ring-[#22c55e]"
              />
              <span className="text-sm text-gray-700">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Location</h3>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
        >
          <option value="all">All States</option>
          {nigerianStates.map((state) => (
            <option key={state.code} value={state.name}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const formatPrice = useCurrency();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get("category") || "all");
  const [selectedCarBrand, setSelectedCarBrand] = useState<string>(searchParams.get("carBrand") || "all");

  useEffect(() => {
    const cat = searchParams.get("category");
    setSelectedCategory(cat && cat !== "all" ? cat : "all");
    const brand = searchParams.get("carBrand");
    setSelectedCarBrand(brand && brand !== "all" ? brand : "all");
  }, [searchParams]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("category");
    else next.set("category", val);
    if (val !== "vehicles") {
      next.delete("carBrand");
      setSelectedCarBrand("all");
    }
    setSearchParams(next);
  };

  const handleCarBrandChange = (val: string) => {
    setSelectedCarBrand(val);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("carBrand");
    else next.set("carBrand", val);
    setSearchParams(next);
  };

  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ListingSort>("recent");
  const urlSearch = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);

  const [listPage, setListPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const defaultProducts = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400",
      title: "iPhone 13 Pro Max 256GB",
      price: 450000,
      location: "Ikeja, Lagos",
      rating: 4.8,
      reviews: 24,
      condition: "Like New",
      category: "electronics",
      sellerTier: "crown",
      status: "active",
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      title: "Nike Air Max 270 Shoes",
      price: 25000,
      location: "Wuse, Abuja",
      rating: 5.0,
      reviews: 18,
      condition: "New",
      category: "fashion",
      sellerTier: "blue",
      status: "active",
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      title: "Sony WH-1000XM4 Headphones",
      price: 85000,
      location: "Victoria Island, Lagos",
      rating: 4.5,
      reviews: 32,
      condition: "Good",
      category: "electronics",
      sellerTier: "standard",
      status: "active",
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
      title: "Timex Classic Watch",
      price: 15000,
      location: "Enugu",
      rating: 4.7,
      reviews: 12,
      condition: "Like New",
      category: "fashion",
      sellerTier: "crown",
      status: "active",
    },
    {
      id: 5,
      image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400",
      title: "Samsung Galaxy S21",
      price: 220000,
      location: "Lekki, Lagos",
      rating: 4.9,
      reviews: 45,
      condition: "New",
      category: "electronics",
      sellerTier: "unverified",
      status: "active",
    },
    {
      id: 6,
      image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
      title: "Adidas Sneakers",
      price: 18000,
      location: "Garki, Abuja",
      rating: 4.6,
      reviews: 20,
      condition: "Good",
      category: "fashion",
      sellerTier: "blue",
      status: "active",
    },
  ];

  const [products, setProducts] = useState(defaultProducts as Array<Record<string, unknown>>);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  const filterOpts: ListingFilterOpts = useMemo(
    () => ({
      category: selectedCategory,
      condition: selectedCondition,
      state: selectedState,
      priceRange,
      carBrand: selectedCategory === "vehicles" ? selectedCarBrand : "all",
    }),
    [selectedCategory, selectedCondition, selectedState, priceRange, selectedCarBrand],
  );

  const filterSignal = useMemo(
    () =>
      [
        sanitizeSearchTerm(urlSearch),
        selectedCategory,
        selectedCarBrand,
        selectedCondition,
        selectedState,
        priceRange,
        sortBy,
      ].join("|"),
    [urlSearch, selectedCategory, selectedCarBrand, selectedCondition, selectedState, priceRange, sortBy],
  );

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    setListPage(0);
  }, [filterSignal]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (listPage === 0) {
        setIsLoadingProducts(true);
        setProductLoadError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const term = sanitizeSearchTerm(urlSearch);
        let q = listingBaseQuery(supabase);
        q = withSearchOr(q, term);
        q = applyListingFilters(q, filterOpts);
        q = applyListingSort(q, sortBy);
        const from = listPage * PRODUCTS_PAGE_SIZE;
        const to = from + PRODUCTS_PAGE_SIZE - 1;
        q = q.range(from, to);

        const { data, error, count } = await q;
        if (cancelled) return;
        if (error) throw error;

        const rows = data ?? [];
        const mapped = rows.map((row) => mapProductRow(row as Record<string, unknown>));

        if (listPage === 0) {
          setProducts(mapped.length ? mapped : []);
          setTotalCount(typeof count === "number" ? count : mapped.length);
        } else {
          setProducts((prev) => [...prev, ...mapped]);
        }
      } catch (err: unknown) {
        if (!cancelled && listPage === 0) {
          console.error(err);
          setProductLoadError(err instanceof Error ? err.message : "Unable to load products");
          setProducts(defaultProducts as Array<Record<string, unknown>>);
          setTotalCount(defaultProducts.length);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
          setIsLoadingMore(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [listPage, filterSignal, filterOpts, sortBy, urlSearch]);

  const commitSearch = () => {
    const next = new URLSearchParams(searchParams);
    const q = sanitizeSearchTerm(searchInput);
    if (q) next.set("search", q);
    else next.delete("search");
    setSearchParams(next);
  };

  const loadMore = useCallback(() => {
    if (isLoadingProducts || isLoadingMore) return;
    if (totalCount != null && products.length >= totalCount) return;
    setListPage((p) => p + 1);
  }, [isLoadingProducts, isLoadingMore, totalCount, products.length]);

  const clearAllFilters = () => {
    handleCategoryChange("all");
    setSelectedCarBrand("all");
    setSelectedCondition("all");
    setPriceRange("all");
    setSelectedState("all");
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "crown":
        return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-yellow-500 drop-shadow-sm" title="Crown Verified" />;
      case "blue":
        return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-blue-500 drop-shadow-sm" title="Blue Verified" />;
      case "standard":
        return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-green-500 drop-shadow-sm" title="Standard Verified" />;
      default:
        return null;
    }
  };

  const featuredIds = useMemo(() => getFeaturedProductIds(), [products]);

  const displayProducts = useMemo(
    () => mixFeaturedProducts(products as Array<Record<string, unknown>>, featuredIds) as typeof products,
    [products, featuredIds],
  );

  const hasMore = totalCount != null && products.length < totalCount;
  const showChips =
    sanitizeSearchTerm(urlSearch) ||
    selectedCategory !== "all" ||
    (selectedCategory === "vehicles" && selectedCarBrand !== "all") ||
    selectedCondition !== "all" ||
    priceRange !== "all" ||
    selectedState !== "all";

  const filterFieldsProps = {
    selectedCategory,
    handleCategoryChange,
    selectedCarBrand,
    handleCarBrandChange,
    selectedCondition,
    setSelectedCondition,
    priceRange,
    setPriceRange,
    selectedState,
    setSelectedState,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="p-2 -ml-2" aria-label="Back to home">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
            </div>
            <button
              type="button"
              onClick={commitSearch}
              className="hidden sm:inline-flex items-center px-3 py-2 bg-[#15803d] text-white text-sm font-medium rounded-lg hover:bg-[#166534]"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="lg:hidden p-2 bg-[#22c55e] rounded-lg text-white shrink-0"
              aria-label="Open filters"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {showChips && (
            <div className="flex gap-2 flex-wrap">
              {sanitizeSearchTerm(urlSearch) && (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-1 rounded text-xs">
                  <span>&quot;{sanitizeSearchTerm(urlSearch)}&quot;</span>
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete("search");
                      setSearchParams(next);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedCategory !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{categories.find((c) => c.id === selectedCategory)?.name}</span>
                  <button type="button" onClick={() => handleCategoryChange("all")} aria-label="Clear category">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedCategory === "vehicles" && selectedCarBrand !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{labelForCarBrandValue(selectedCarBrand)}</span>
                  <button type="button" onClick={() => handleCarBrandChange("all")} aria-label="Clear car brand">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedCondition !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{selectedCondition}</span>
                  <button type="button" onClick={() => setSelectedCondition("all")} aria-label="Clear condition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {priceRange !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{priceRanges.find((r) => r.value === priceRange)?.label ?? "Price"}</span>
                  <button type="button" onClick={() => setPriceRange("all")} aria-label="Clear price filter">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedState !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{selectedState}</span>
                  <button type="button" onClick={() => setSelectedState("all")} aria-label="Clear location">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex flex-wrap items-center justify_gap gap-3 max-w-7xl mx-auto">
          <span className="text-sm text-gray-600">
            {isLoadingProducts && listPage === 0
              ? "Loading…"
              : totalCount != null
                ? `Showing ${Math.min(products.length, totalCount)} of ${totalCount} products`
                : `${displayProducts.length} products`}
            {!isLoadingProducts && productLoadError && (
              <span className="text-amber-700 ml-2 text-xs">(offline sample data)</span>
            )}
          </span>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-sm text-gray-600">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ListingSort)}
              className="text-sm font-medium text-[#22c55e] bg-transparent border border-[#22c55e]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="recent">Newest first</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest rated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 flex gap-8 items-start">
        <aside className="hidden lg:block w-72 shrink-0 sticky top-28 self-start">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Filters</h2>
              <button type="button" onClick={clearAllFilters} className="text-xs text-[#16a34a] font-medium hover:underline">
                Clear all
              </button>
            </div>
            <ProductsFilterFields {...filterFieldsProps} />
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {isLoadingProducts && listPage === 0 ? (
            <div className="flex justify-center py-20 text-gray-600 text-sm">Loading products…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {displayProducts.map((product) => (
                  <Link key={String(product.id)} to={`/products/${product.id}`}>
                    <ProductCard
                      image={String(product.image ?? "")}
                      condition={(product.condition as ProductCardPropsCondition) ?? "Good"}
                      title={String(product.title ?? "")}
                      titleAdornment={getTierIcon(String(product.sellerTier ?? ""))}
                      price={Number(product.price) || 0}
                      priceDisplay={formatPrice(Number(product.price) || 0)}
                      location={String(product.location ?? "")}
                      rating={Number(product.rating) || 0}
                      reviews={product.reviews != null ? Number(product.reviews) : undefined}
                      topRightBadge={
                        featuredIds.has(String(product.id)) ? (
                          <span className="bg-amber-400 text-amber-950 text-[10px] md:text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                            <Star className="w-3 h-3 fill-current" />
                            FEATURED
                          </span>
                        ) : undefined
                      }
                    />
                  </Link>
                ))}
              </div>

              {hasMore && !productLoadError && (
                <div className="flex justify-center mt-8">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="px-8 py-3 rounded-xl bg-white border-2 border-[#22c55e] text-[#15803d] font-semibold hover:bg-[#22c55e]/10 disabled:opacity-50 transition-colors"
                  >
                    {isLoadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}

          {!isLoadingProducts && displayProducts.length === 0 && (
            <div className="text-center py-12 max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No products found</h3>
              {sanitizeSearchTerm(urlSearch) ? (
                <>
                  <p className="text-gray-600 text-sm mb-4">
                    No products found for &quot;{sanitizeSearchTerm(urlSearch)}&quot;.
                  </p>
                  <p className="text-gray-500 text-sm mb-4">Try different keywords or browse by category.</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Link
                      to={selectedCategory !== "all" ? `/products?category=${selectedCategory}` : "/products"}
                      className="text-sm text-[#22c55e] font-medium hover:underline"
                    >
                      Clear search
                    </Link>
                    <span className="hidden sm:inline text-gray-300">·</span>
                    <Link to="/" className="text-sm text-[#22c55e] font-medium hover:underline">
                      Back to home
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-gray-600 text-sm">Try adjusting your filters or search query.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {showFilters && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:hidden">
          <div className="bg-white w-full max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              <ProductsFilterFields {...filterFieldsProps} />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                  }}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ProductCardPropsCondition = "New" | "Like New" | "Good" | "Fair";
