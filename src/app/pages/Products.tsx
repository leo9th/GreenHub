import { useState, useEffect, useMemo, useCallback, type ReactNode, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Filter, ArrowLeft, X, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { categories, nigerianStates } from "../data/catalogConstants";
import { labelForCarBrandValue, NIGERIA_CAR_BRAND_OPTIONS } from "../data/carBrands";
import { useCurrency } from "../hooks/useCurrency";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { ProductCard } from "../components/cards/ProductCard";
import { ProductCardSkeletonGrid } from "../components/cards/ProductCardSkeleton";
import { SortBar } from "../components/SortBar";
import {
  fetchLikedProductIdsForUser,
  fetchProductLikeCount,
  normalizeProductPk,
  productLikeSetKey,
  productRowKey,
  subscribeToProductLikes,
  toggleProductLike,
  type ProductPk,
} from "../utils/engagement";
import { BoostCardBadge } from "../components/BoostBadge";
import {
  fetchProductsListingRpc,
  mapProductRow,
  listingPaginationItems,
  parseListingPageParam,
  parseListingSort,
  PRODUCTS_PAGE_SIZE,
  sanitizeSearchTerm,
  type ListingFilterOpts,
  type ListingSort,
} from "../utils/productSearch";
import { getRelatedSearchSuggestions } from "../utils/searchSuggestions";
import { getProductThumbnailUrl } from "../utils/productImages";
import { useVerifiedSellerIds } from "../hooks/useVerifiedSellerIds";

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
  const { user: authUser } = useAuth();
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
    next.delete("page");
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
    next.delete("page");
    if (val === "all") next.delete("carBrand");
    else next.set("carBrand", val);
    setSearchParams(next);
  };

  const [selectedCondition, setSelectedCondition] = useState<string>(() => searchParams.get("condition") || "all");
  const [selectedState, setSelectedState] = useState<string>(() => searchParams.get("state") || "all");
  const [priceRange, setPriceRange] = useState<string>(() => searchParams.get("price") || "all");
  const [sortBy, setSortBy] = useState<ListingSort>(() => parseListingSort(searchParams.get("sort")));
  const urlSearch = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);

  useEffect(() => {
    setSortBy(parseListingSort(searchParams.get("sort")));
    setSelectedCondition(searchParams.get("condition") || "all");
    setSelectedState(searchParams.get("state") || "all");
    setPriceRange(searchParams.get("price") || "all");
  }, [searchParams]);

  const setSearchParamsSoft = useCallback(
    (mutate: (p: URLSearchParams) => void, replace = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      }, { replace });
    },
    [setSearchParams],
  );

  const commitCondition = useCallback(
    (v: string) => {
      setSelectedCondition(v);
      setSearchParamsSoft((p) => {
        p.delete("page");
        if (v === "all") p.delete("condition");
        else p.set("condition", v);
      });
    },
    [setSearchParamsSoft],
  );

  const commitStateFilter = useCallback(
    (v: string) => {
      setSelectedState(v);
      setSearchParamsSoft((p) => {
        p.delete("page");
        if (v === "all") p.delete("state");
        else p.set("state", v);
      });
    },
    [setSearchParamsSoft],
  );

  const commitPriceRange = useCallback(
    (v: string) => {
      setPriceRange(v);
      setSearchParamsSoft((p) => {
        p.delete("page");
        if (v === "all") p.delete("price");
        else p.set("price", v);
      });
    },
    [setSearchParamsSoft],
  );

  const commitSort = useCallback(
    (next: ListingSort) => {
      setSortBy(next);
      setSearchParamsSoft((p) => {
        p.delete("page");
        if (next === "recent") p.delete("sort");
        else p.set("sort", next);
      });
    },
    [setSearchParamsSoft],
  );

  const relatedSearches = useMemo(() => getRelatedSearchSuggestions(urlSearch), [urlSearch]);

  const buildFilteredHref = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(searchParams);
      p.delete("page");
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === "all") p.delete(k);
        else p.set(k, v);
      }
      const cat = p.get("category");
      if (cat && cat !== "vehicles") p.delete("carBrand");
      const qs = p.toString();
      return qs ? `/products?${qs}` : "/products";
    },
    [searchParams],
  );

  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [likedProductIds, setLikedProductIds] = useState<Set<string>>(new Set());
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set());
  const verifiedSellerIds = useVerifiedSellerIds(supabase, products);
  const productIds = useMemo(() => {
    const seen = new Set<string>();
    const out: ProductPk[] = [];
    for (const p of products) {
      const pk = normalizeProductPk(p.id);
      if (pk == null) continue;
      const k = productLikeSetKey(pk);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(pk);
    }
    return out;
  }, [products]);
  const productIdsKey = useMemo(() => productIds.map(productLikeSetKey).join(","), [productIds]);
  const productIdStrings = useMemo(() => productIds.map(String), [productIds]);

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
    if (!authUser?.id || products.length === 0) {
      setLikedProductIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchLikedProductIdsForUser(supabase, authUser.id, productIds).then((set) => {
      if (!cancelled) setLikedProductIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, productIdsKey]);

  useEffect(() => {
    if (productIdStrings.length === 0) {
      setCommentCounts({});
      return;
    }
    let cancelled = false;
    const loadCommentCounts = async () => {
      const { data, error } = await supabase
        .from("product_comments")
        .select("product_id")
        .in("product_id", productIdStrings);
      if (cancelled) return;
      if (error) {
        console.warn("Products comment counts:", error.message);
        setCommentCounts({});
        return;
      }
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { product_id: string | number }[]) {
        if (row.product_id != null) {
          const key = String(row.product_id);
          map[key] = (map[key] ?? 0) + 1;
        }
      }
      setCommentCounts(map);
    };
    void loadCommentCounts();
    return () => {
      cancelled = true;
    };
  }, [productIdsKey]);

  useEffect(() => {
    if (productIds.length === 0) return;
    const channels = productIds.map((id) =>
      subscribeToProductLikes(supabase, id, (count) => {
        const key = productLikeSetKey(id);
        setProducts((prev) =>
          prev.map((p) => (productRowKey(p.id) === key ? { ...p, like_count: count } : p)),
        );
      }),
    );
    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [productIdsKey]);

  const currentPage = parseListingPageParam(searchParams.get("page"));

  const onProductLike = useCallback(
    async (e: MouseEvent, row: Record<string, unknown>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!authUser?.id) {
        toast.message("Login to like");
        return;
      }
      const id = normalizeProductPk(row.id);
      if (id == null) return;
      const rowKey = productLikeSetKey(id);
      if (pendingLikeIds.has(rowKey)) return;
      const liked = likedProductIds.has(rowKey);
      const prevCount = Number(row.like_count ?? 0);
      const nextLiked = !liked;
      const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
      setPendingLikeIds((prev) => new Set(prev).add(rowKey));
      setLikedProductIds((prev) => {
        const n = new Set(prev);
        if (nextLiked) n.add(rowKey);
        else n.delete(rowKey);
        return n;
      });
      setProducts((prev) =>
        prev.map((p) => (productRowKey(p.id) === rowKey ? { ...p, like_count: nextCount } : p)),
      );
      try {
        const { error } = await toggleProductLike(supabase, id, authUser.id, liked);
        if (error) throw new Error(error);
        const syncedCount = await fetchProductLikeCount(supabase, id);
        setProducts((prev) =>
          prev.map((p) => (productRowKey(p.id) === rowKey ? { ...p, like_count: syncedCount } : p)),
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message.trim() ? error.message : "Could not update like";
        toast.error(message);
        setLikedProductIds((prev) => {
          const n = new Set(prev);
          if (liked) n.add(rowKey);
          else n.delete(rowKey);
          return n;
        });
        setProducts((prev) =>
          prev.map((p) => (productRowKey(p.id) === rowKey ? { ...p, like_count: prevCount } : p)),
        );
      } finally {
        setPendingLikeIds((prev) => {
          const next = new Set(prev);
          next.delete(rowKey);
          return next;
        });
      }
    },
    [authUser?.id, likedProductIds, pendingLikeIds],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoadingProducts(true);
      setProductLoadError(null);

      try {
        const term = sanitizeSearchTerm(urlSearch);
        const from = (currentPage - 1) * PRODUCTS_PAGE_SIZE;
        const { rows, total, error } = await fetchProductsListingRpc(supabase, {
          searchTerm: term,
          filterOpts,
          sortBy,
          limit: PRODUCTS_PAGE_SIZE,
          offset: from,
        });
        if (cancelled) return;
        if (error) throw new Error(error);

        const mapped = rows.map((row) => mapProductRow(row));

        setProducts(mapped.length ? mapped : []);
        setTotalCount(total);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err);
          setProductLoadError(err instanceof Error ? err.message : "Unable to load products");
          setProducts([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentPage, filterSignal, filterOpts, sortBy, urlSearch]);

  const commitSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    const q = sanitizeSearchTerm(searchInput);
    if (q) next.set("search", q);
    else next.delete("search");
    setSearchParams(next);
  };

  const totalPages = Math.max(1, totalCount != null ? Math.ceil(totalCount / PRODUCTS_PAGE_SIZE) : 1);

  const goToPage = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), totalPages);
      setSearchParamsSoft((sp) => {
        if (target <= 1) sp.delete("page");
        else sp.set("page", String(target));
      });
    },
    [setSearchParamsSoft, totalPages],
  );

  useEffect(() => {
    if (totalCount == null || totalCount <= 0) return;
    const tp = Math.max(1, Math.ceil(totalCount / PRODUCTS_PAGE_SIZE));
    if (currentPage > tp) {
      setSearchParamsSoft((sp) => {
        if (tp <= 1) sp.delete("page");
        else sp.set("page", String(tp));
      });
    }
  }, [totalCount, currentPage, setSearchParamsSoft]);

  const clearAllFilters = () => {
    setSelectedCategory("all");
    setSelectedCarBrand("all");
    setSelectedCondition("all");
    setPriceRange("all");
    setSelectedState("all");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("page");
      next.delete("category");
      next.delete("carBrand");
      next.delete("condition");
      next.delete("state");
      next.delete("price");
      return next;
    });
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "crown":
        return (
          <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-yellow-500 drop-shadow-sm" aria-label="Crown Verified" />
        );
      case "blue":
        return (
          <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-blue-500 drop-shadow-sm" aria-label="Blue Verified" />
        );
      case "standard":
        return (
          <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-green-500 drop-shadow-sm" aria-label="Standard Verified" />
        );
      default:
        return null;
    }
  };

  const paginationItems = useMemo(
    () => listingPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const showingFrom =
    totalCount != null && totalCount > 0 ? (currentPage - 1) * PRODUCTS_PAGE_SIZE + 1 : 0;
  const showingTo =
    totalCount != null ? Math.min(currentPage * PRODUCTS_PAGE_SIZE, totalCount) : 0;

  const showChips =
    sanitizeSearchTerm(urlSearch) ||
    selectedCategory !== "all" ||
    (String(selectedCategory) === "vehicles" && selectedCarBrand !== "all") ||
    selectedCondition !== "all" ||
    priceRange !== "all" ||
    selectedState !== "all";

  const filterFieldsProps = {
    selectedCategory,
    handleCategoryChange,
    selectedCarBrand,
    handleCarBrandChange,
    selectedCondition,
    setSelectedCondition: commitCondition,
    priceRange,
    setPriceRange: commitPriceRange,
    selectedState,
    setSelectedState: commitStateFilter,
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
                      next.delete("page");
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
                  <button type="button" onClick={() => commitCondition("all")} aria-label="Clear condition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {priceRange !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{priceRanges.find((r) => r.value === priceRange)?.label ?? "Price"}</span>
                  <button type="button" onClick={() => commitPriceRange("all")} aria-label="Clear price filter">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedState !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{selectedState}</span>
                  <button type="button" onClick={() => commitStateFilter("all")} aria-label="Clear location">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {relatedSearches.length > 0 ? (
        <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
          <div className="mx-auto max-w-7xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Related searches</p>
            <div className="flex flex-wrap gap-2">
              {relatedSearches.map((s) => (
                <Link
                  key={s}
                  to={buildFilteredHref({ search: sanitizeSearchTerm(s) })}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:border-[#22c55e] hover:text-[#15803d]"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!isLoadingProducts && sanitizeSearchTerm(urlSearch).length >= 2 && products.length === 0 ? (
        <div className="border-b border-amber-100 bg-amber-50/50 px-4 py-3">
          <div className="mx-auto max-w-7xl text-sm text-amber-950">
            <span className="font-semibold">Did you mean? </span>
            <span className="text-amber-900/90">Try a related search above, or broaden your filters.</span>
          </div>
        </div>
      ) : null}

      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick filters</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={buildFilteredHref({ category: c.id })}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    selectedCategory === c.id
                      ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
                      : "border-gray-200 bg-white text-gray-700 hover:border-[#22c55e]/50"
                  }`}
                >
                  <span className="mr-1">{c.emoji}</span>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {conditions.map((cond) => (
              <Link
                key={cond}
                to={buildFilteredHref({ condition: cond === selectedCondition ? "all" : cond })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  selectedCondition === cond
                    ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-[#22c55e]/50"
                }`}
              >
                {cond}
              </Link>
            ))}
            <Link
              to={buildFilteredHref({ price: "0-50000" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                priceRange === "0-50000"
                  ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#22c55e]/50"
              }`}
            >
              Under ₦50k
            </Link>
            <Link
              to={buildFilteredHref({ price: "50000-100000" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                priceRange === "50000-100000"
                  ? "border-[#22c55e] bg-[#22c55e]/10 text-[#15803d]"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#22c55e]/50"
              }`}
            >
              ₦50k–100k
            </Link>
          </div>
          <SortBar
            id="products-sort"
            value={sortBy}
            onChange={commitSort}
            leading={
              <>
                {isLoadingProducts ? (
                  <span>Loading…</span>
                ) : totalCount != null ? (
                  <span>
                    {totalCount === 0
                      ? "No products"
                      : `Showing ${showingFrom}–${showingTo} of ${totalCount} products`}
                  </span>
                ) : (
                  <span>{products.length} products</span>
                )}
                {!isLoadingProducts && productLoadError ? (
                  <span className="ml-2 text-xs text-amber-700">({productLoadError})</span>
                ) : null}
              </>
            }
          />
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
          {isLoadingProducts ? (
            <div className="py-4">
              <ProductCardSkeletonGrid count={PRODUCTS_PAGE_SIZE} />
              <p className="mt-4 text-center text-sm text-gray-500">Loading products…</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full">
                {products.map((product) => {
                  const pid = Number(product.id);
                  const row = product as Record<string, unknown>;
                  const sid = row.seller_id != null ? String(row.seller_id) : "";
                  return (
                    <ProductCard
                      key={String(product.id)}
                      href={`/products/${product.id}`}
                      image={getProductThumbnailUrl(row)}
                      condition={String(product.condition ?? "Good")}
                      title={String(product.title ?? "")}
                      titleAdornment={getTierIcon(String(product.sellerTier ?? ""))}
                      sellerVerified={Boolean(sid && verifiedSellerIds.has(sid))}
                      price={Number(product.price) || 0}
                      priceDisplay={formatPrice(Number(product.price) || 0)}
                      location={String(product.location ?? "")}
                      rating={Number(product.rating) || 0}
                      reviews={product.reviews != null ? Number(product.reviews) : undefined}
                      productId={Number.isFinite(pid) ? pid : String(row.id ?? "")}
                      viewsCount={Number(product.views ?? 0)}
                      likesCount={Number(product.like_count ?? 0)}
                      commentCount={commentCounts[String(product.id)] ?? 0}
                      liked={likedProductIds.has(productRowKey(product.id))}
                      likeDisabled={pendingLikeIds.has(productRowKey(product.id))}
                      onLikeClick={(ev) => void onProductLike(ev, product)}
                      topRightBadge={<BoostCardBadge row={row} />}
                    />
                  );
                })}
              </div>

              {!productLoadError && totalPages > 1 ? (
                <nav
                  className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
                  aria-label="Product list pagination"
                >
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={isLoadingProducts || currentPage <= 1}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>
                    {paginationItems.map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`e-${idx}`}
                          className="px-1 text-sm text-gray-400"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => goToPage(item)}
                          disabled={isLoadingProducts}
                          aria-label={`Page ${item}`}
                          aria-current={item === currentPage ? "page" : undefined}
                          className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border text-sm font-semibold shadow-sm transition-colors disabled:opacity-45 ${
                            item === currentPage
                              ? "border-[#16a34a] bg-[#16a34a] text-white"
                              : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={isLoadingProducts || currentPage >= totalPages}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="Next page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 tabular-nums">
                    Page {currentPage} of {totalPages}
                  </p>
                </nav>
              ) : null}
            </>
          )}

          {!isLoadingProducts && products.length === 0 && (
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
