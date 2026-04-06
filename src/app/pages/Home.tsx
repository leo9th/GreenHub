import { Link, useNavigate } from "react-router";
import { Search, ChevronDown, Star, Globe, Home as HomeIcon, PlusCircle, MessageCircle } from "lucide-react";
import { categories } from "../data/catalogConstants";
import { useRegion, regions } from "../context/RegionContext";
import { useCurrency } from "../hooks/useCurrency";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";
import { useAuth } from "../context/AuthContext";
import { useInboxNotifications } from "../context/InboxNotificationsContext";
import { fetchLikedProductIdsForUser, toggleProductLike } from "../utils/engagement";
import { toast } from "sonner";
import { getProductPrice } from "../utils/getProductPrice";
import { getFeaturedProductIds, mixFeaturedProducts } from "../utils/featureProductMix";
import { SortBar } from "../components/SortBar";
import {
  activeProductsQuery,
  mapProductRow,
  sanitizeSearchTerm,
  sortProductsClientSide,
  withSearchOr,
  type ListingSort,
} from "../utils/productSearch";
import { getRelatedSearchSuggestions } from "../utils/searchSuggestions";

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { messageUnread } = useInboxNotifications();
  const { activeRegion, setRegion } = useRegion();
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchPreviewHits, setSearchPreviewHits] = useState<Array<Record<string, unknown>>>([]);

  // Custom Ad State
  const [customBanner, setCustomBanner] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [categoryAdCounts, setCategoryAdCounts] = useState<Record<string, number>>({});
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [likedProductIds, setLikedProductIds] = useState<Set<number>>(new Set());
  const [homeSort, setHomeSort] = useState<ListingSort>("recent");

  const featuredIds = useMemo(() => getFeaturedProductIds(), [products]);

  const sortedProducts = useMemo(() => sortProductsClientSide(products, homeSort), [products, homeSort]);

  const featuredItemsDisplay = useMemo(
    () => mixFeaturedProducts(sortedProducts, featuredIds),
    [sortedProducts, featuredIds],
  );

  const homeCardIds = useMemo(() => {
    const fromFeatured = featuredItemsDisplay.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
    const fromRecent = sortedProducts.slice(0, 2).map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
    return [...new Set([...fromFeatured, ...fromRecent])];
  }, [featuredItemsDisplay, sortedProducts]);

  const homeRelatedSearches = useMemo(
    () => getRelatedSearchSuggestions(searchQuery),
    [searchQuery],
  );

  useEffect(() => {
    if (!authUser?.id || homeCardIds.length === 0) {
      setLikedProductIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchLikedProductIdsForUser(supabase, authUser.id, homeCardIds).then((set) => {
      if (!cancelled) setLikedProductIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, homeCardIds]);

  const onProductLike = useCallback(
    async (e: React.MouseEvent, row: Record<string, unknown>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!authUser?.id) {
        toast.message("Sign in to like listings");
        return;
      }
      const id = Number(row.id);
      if (!Number.isFinite(id)) return;
      const liked = likedProductIds.has(id);
      const prevCount = Number(row.like_count ?? 0);
      const nextLiked = !liked;
      const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
      setLikedProductIds((prev) => {
        const n = new Set(prev);
        if (nextLiked) n.add(id);
        else n.delete(id);
        return n;
      });
      setProducts((prev) => prev.map((p) => (Number(p.id) === id ? { ...p, like_count: nextCount } : p)));
      const { error } = await toggleProductLike(supabase, id, authUser.id, liked);
      if (error) {
        toast.error(error);
        setLikedProductIds((prev) => {
          const n = new Set(prev);
          if (liked) n.add(id);
          else n.delete(id);
          return n;
        });
        setProducts((prev) => prev.map((p) => (Number(p.id) === id ? { ...p, like_count: prevCount } : p)));
      }
    },
    [authUser?.id, likedProductIds, supabase],
  );

  useEffect(() => {
    const banner = localStorage.getItem("greenhub_custom_banner");
    if (banner) setCustomBanner(banner);

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductLoadError(null);

      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = data ?? [];
        const counts: Record<string, number> = {};
        for (const product of rows) {
          const raw =
            typeof product.category === "string" ? product.category.replace(/"/g, "").trim().toLowerCase() : "";
          const key = raw || "other";
          counts[key] = (counts[key] || 0) + 1;
        }
        setCategoryAdCounts(counts);

        const serverProducts = rows.map((product: Record<string, unknown>) => ({
          ...product,
          price: getProductPrice(product),
          sellerId: product.seller_id,
          sellerTier: product.seller_tier,
          deliveryOptions: product.delivery_options,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        }));

        setProducts(serverProducts);
      } catch (error: unknown) {
        console.error("Error loading products from Supabase:", error);
        setProductLoadError(error instanceof Error ? error.message : "Unable to load products");
        setProducts([]);
        setCategoryAdCounts({});
      } finally {
        setIsLoadingProducts(false);
      }
    };

    void loadProducts();
  }, [activeRegion.id]);

  useEffect(() => {
    const cleaned = sanitizeSearchTerm(searchQuery);
    if (cleaned.length < 2) {
      setSearchPreviewHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const term = sanitizeSearchTerm(searchQuery);
      if (term.length < 2) return;
      try {
        let q = activeProductsQuery(supabase);
        q = withSearchOr(q, term);
        const { data, error } = await q.limit(15);
        if (cancelled || error) return;
        setSearchPreviewHits((data ?? []).map((row) => mapProductRow(row as Record<string, unknown>)));
      } catch {
        if (!cancelled) setSearchPreviewHits([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery]);

  const submitSearch = () => {
    const q = sanitizeSearchTerm(searchQuery);
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : "/products");
    setIsSearchFocused(false);
  };

  // Reusable format helper
  const formatPrice = useCurrency();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Search Section */}
      <header className="bg-[#22c55e] sticky top-16 z-40 pb-4 pt-1 shadow-sm md:shadow-none">
        <div className="px-4 max-w-7xl mx-auto">
          <h2 className="text-white text-center text-xl md:text-2xl font-bold mb-4 hidden md:block">
            What are you looking for?
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="flex flex-col gap-2 w-full max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2 md:gap-0 w-full">
              {/* Desktop Location Dropdown */}
              <div className="relative hidden md:flex">
                <button
                  type="button"
                  onClick={() => setShowRegionDropdown(!showRegionDropdown)}
                  className="flex items-center gap-2 bg-white px-4 py-3 border-r border-gray-200 text-gray-700 min-w-[150px] hover:bg-gray-50 rounded-l-lg h-full"
                >
                  <Globe className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-sm font-medium">{activeRegion.defaultLocation}</span>
                  <ChevronDown className="w-4 h-4 ml-auto text-gray-500" />
                </button>

                {showRegionDropdown && (
                  <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                    {Object.values(regions).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setRegion(r.id);
                          setShowRegionDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-0 ${activeRegion.id === r.id ? "bg-green-50 text-green-700 font-semibold" : "text-gray-700"}`}
                      >
                        {r.name} ({r.currencyCode})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex-1 flex flex-col justify-center min-w-0">
                <div className="w-full relative h-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="search"
                    placeholder="I am looking for..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 220)}
                    className="w-full h-full pl-10 pr-4 py-3 focus:outline-none text-gray-900 rounded-lg md:rounded-none"
                  />
                </div>

                {isSearchFocused && sanitizeSearchTerm(searchQuery).length > 0 && (
                  <div className="absolute top-[48px] left-0 z-50 max-h-[min(28rem,70vh)] w-full overflow-y-auto rounded-b-lg border border-gray-200 bg-white shadow-xl md:-left-[150px] md:w-[calc(100%+150px)]">
                    {searchPreviewHits.length === 0 && sanitizeSearchTerm(searchQuery).length < 2 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters for suggestions</div>
                    ) : null}
                    {sanitizeSearchTerm(searchQuery).length >= 2 && homeRelatedSearches.length > 0 ? (
                      <div className="border-b border-gray-100 px-4 py-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Related searches
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {homeRelatedSearches.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-800 hover:border-[#22c55e] hover:text-[#15803d]"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                navigate(`/products?search=${encodeURIComponent(sanitizeSearchTerm(s))}`);
                                setIsSearchFocused(false);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {searchPreviewHits.map((hit) => (
                      <button
                        key={String(hit.id)}
                        type="button"
                        className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate(`/products/${hit.id}`);
                          setIsSearchFocused(false);
                        }}
                      >
                        <Search className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="line-clamp-1 text-gray-900">{String(hit.title ?? "")}</span>
                      </button>
                    ))}
                    {sanitizeSearchTerm(searchQuery).length >= 2 && (
                      <button
                        type="button"
                        className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-medium text-[#15803d] hover:bg-green-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          submitSearch();
                        }}
                      >
                        See all results for &quot;{sanitizeSearchTerm(searchQuery)}&quot; (matches in title)
                      </button>
                    )}
                    {sanitizeSearchTerm(searchQuery).length >= 2 && searchPreviewHits.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-500">
                        No quick title matches — try &quot;See all results&quot; or a different keyword.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="flex md:hidden items-center justify-center bg-[#15803d] text-white p-3 rounded-lg font-semibold hover:bg-[#166534] shrink-0"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                type="submit"
                className="hidden md:flex items-center justify-center bg-[#15803d] text-white px-8 py-3 rounded-r-lg font-semibold hover:bg-[#166534] transition-colors"
              >
                <Search className="w-5 h-5 mr-2" />
                Search
              </button>
            </div>

            {isSearchFocused && sanitizeSearchTerm(searchQuery).length >= 2 && searchPreviewHits.length > 0 && (
              <div className="bg-white/95 rounded-lg border border-white/40 shadow-md p-2 overflow-x-auto no-scrollbar flex gap-2 md:ml-[150px]">
                <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0 py-2 pr-1">Quick</span>
                {searchPreviewHits.slice(0, 5).map((hit) => (
                  <Link
                    key={String(hit.id)}
                    to={`/products/${hit.id}`}
                    onMouseDown={() => setIsSearchFocused(false)}
                    className="flex items-center gap-2 shrink-0 max-w-[200px] rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 hover:border-[#22c55e] hover:bg-white"
                  >
                    {hit.image ? (
                      <img src={String(hit.image)} alt="" className="w-10 h-10 rounded object-cover bg-gray-200" />
                    ) : null}
                    <span className="text-xs text-gray-800 line-clamp-2">{String(hit.title ?? "")}</span>
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:px-4 md:py-6 md:flex md:gap-6 md:items-start">
        {/* Categories Sidebar (Desktop) / Scroller (Mobile) */}
        <div className="bg-white border-b border-gray-200 md:border md:rounded-xl md:w-64 md:shrink-0 md:sticky md:top-36 md:mb-0 mb-4 px-4 py-4 md:p-0">
          <div className="flex md:flex-col overflow-x-auto no-scrollbar gap-6 md:gap-0">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.id}`}
                className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4 min-w-[72px] md:min-w-0 md:px-4 md:py-3 md:border-b md:border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <div className="w-14 h-14 md:w-10 md:h-10 bg-gray-100 rounded-full flex items-center justify-center text-2xl md:text-xl shrink-0">
                  {category.emoji}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <span className="text-xs md:text-sm text-gray-700 font-medium md:font-semibold block">{category.name}</span>
                  <span className="hidden md:block text-xs text-gray-400 mt-0.5">
                    {categoryAdCounts[category.id] ?? 0} live {categoryAdCounts[category.id] === 1 ? "ad" : "ads"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 px-4 py-0 md:px-0">
          
          {/* Primary Navigation Icons (Moved to Top) */}
          <div className="grid grid-cols-4 gap-2 md:gap-4 mb-6 bg-white py-4 md:py-6 border-b border-gray-200 md:border md:rounded-xl md:shadow-sm">
            <Link to="/" className="flex flex-col items-center justify-center gap-2 group cursor-pointer text-[#22c55e]">
              <HomeIcon className="w-6 h-6 md:w-8 md:h-8 transition-transform group-hover:scale-110" />
              <span className="font-medium text-xs md:text-sm">Home</span>
            </Link>
            <Link to="/products" className="flex flex-col items-center justify-center gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e]">
              <Search className="w-6 h-6 md:w-8 md:h-8 transition-transform group-hover:scale-110" />
              <span className="font-medium text-xs md:text-sm">Search</span>
            </Link>
            <Link to="/seller/products/new" className="flex flex-col items-center justify-center gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e]">
              <PlusCircle className="w-6 h-6 md:w-8 md:h-8 transition-transform group-hover:scale-110" />
              <span className="font-medium text-xs md:text-sm">Sell</span>
            </Link>
            <Link
              to="/messages"
              className="relative flex flex-col items-center justify-center gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e]"
            >
              <MessageCircle className="w-6 h-6 md:w-8 md:h-8 transition-transform group-hover:scale-110" />
              {messageUnread > 0 ? (
                <span className="absolute top-0 right-1/4 translate-x-2 min-w-[1.1rem] h-4 px-0.5 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                  {messageUnread > 99 ? "99+" : messageUnread}
                </span>
              ) : null}
              <span className="font-medium text-xs md:text-sm">Messages</span>
            </Link>
          </div>

          {/* Dynamic Sponsored Banner */}
          {customBanner && (
            <div className="mb-8 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group">
              <img src={customBanner} alt="Sponsored Ad" className="w-full h-48 md:h-64 object-cover" />
              <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                Sponsored
              </div>
            </div>
          )}

          {/* Featured Items */}
          <div className="mb-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-gray-800">Featured Items</h2>
              <Link to="/products" className="text-sm text-[#22c55e] sm:shrink-0">
                View All →
              </Link>
            </div>

            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick filters</p>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    to={`/products?category=${encodeURIComponent(c.id)}`}
                    className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:border-[#22c55e] hover:text-[#15803d]"
                  >
                    <span className="mr-1">{c.emoji}</span>
                    {c.name}
                  </Link>
                ))}
              </div>
              <SortBar id="home-sort" value={homeSort} onChange={setHomeSort} />
            </div>

            {isLoadingProducts ? (
              <p className="text-sm text-gray-500 py-8 text-center">Loading listings…</p>
            ) : featuredItemsDisplay.length === 0 ? (
              <p className="text-sm text-gray-600 py-8 text-center rounded-xl border border-dashed border-gray-200 bg-white">
                No products found yet. Listings with status &quot;active&quot; will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {featuredItemsDisplay.map((product) => {
                  const row = product as Record<string, unknown>;
                  const pid = Number(row.id);
                  return (
                    <Link key={String(product.id)} to={`/products/${product.id}`} className="block h-full">
                      <ProductCard
                        image={String((product as { image?: string }).image ?? "")}
                        condition={String((product as { condition?: string }).condition ?? "Good")}
                        title={String((product as { title?: string }).title ?? "")}
                        price={Number((product as { price?: number }).price) || 0}
                        priceDisplay={formatPrice(Number((product as { price?: number }).price) || 0)}
                        location={String((product as { location?: string }).location ?? "")}
                        rating={Number((product as { rating?: number }).rating) || 0}
                        productId={Number.isFinite(pid) ? pid : undefined}
                        viewsCount={Number(row.views ?? 0)}
                        likesCount={Number(row.like_count ?? 0)}
                        liked={likedProductIds.has(pid)}
                        onLikeClick={(ev) => void onProductLike(ev, row)}
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Recently Viewed */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-3">Recently Viewed</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {sortedProducts.length > 0 ? sortedProducts.slice(0, 2).map((product) => {
                const row = product as Record<string, unknown>;
                const pid = Number(row.id);
                return (
                  <Link key={String(product.id)} to={`/products/${product.id}`} className="block h-full">
                    <ProductCard
                      image={String((product as { image?: string }).image ?? "")}
                      condition={String((product as { condition?: string }).condition ?? "Good")}
                      title={String((product as { title?: string }).title ?? "")}
                      price={Number((product as { price?: number }).price) || 0}
                      priceDisplay={formatPrice(Number((product as { price?: number }).price) || 0)}
                      location={String((product as { location?: string }).location ?? "")}
                      rating={Number((product as { rating?: number }).rating) || 0}
                      productId={Number.isFinite(pid) ? pid : undefined}
                      viewsCount={Number(row.views ?? 0)}
                      likesCount={Number(row.like_count ?? 0)}
                      liked={likedProductIds.has(pid)}
                      onLikeClick={(ev) => void onProductLike(ev, row)}
                    />
                  </Link>
                );
              }) : (
                <p className="text-sm text-gray-500 col-span-full">Browse products to see recents here.</p>
              )}
            </div>
          </div>

          {/* Safety Tips Banner */}
          <div className="bg-[#eab308]/10 border border-[#eab308]/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Safety Tips</h3>
                <p className="text-sm text-gray-600">Meet in public places, inspect before paying</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
