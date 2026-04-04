import { Link, useNavigate } from "react-router";
import { Search, ChevronDown, Star, Globe, Home as HomeIcon, PlusCircle, MessageCircle } from "lucide-react";
import { categories } from "../data/mockData";
import { getMockProductsForRegion } from "../data/mockData";
import { useRegion, regions } from "../context/RegionContext";
import { useCurrency } from "../hooks/useCurrency";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";
import { getProductPrice } from "../utils/getProductPrice";
import { getFeaturedProductIds, mixFeaturedProducts } from "../utils/featureProductMix";
import {
  activeProductsQuery,
  mapProductRow,
  sanitizeSearchTerm,
  withSearchOr,
} from "../utils/productSearch";

export default function Home() {
  const navigate = useNavigate();
  const { activeRegion, setRegion } = useRegion();
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchPreviewHits, setSearchPreviewHits] = useState<Array<Record<string, unknown>>>([]);
  const baseProducts = getMockProductsForRegion(activeRegion.id as "NG" | "US" | "CN");

  // Custom Ad State
  const [customBanner, setCustomBanner] = useState<string | null>(null);
  const [products, setProducts] = useState(baseProducts as Array<any>);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  const featuredIds = useMemo(() => getFeaturedProductIds(), [products]);

  const featuredItemsDisplay = useMemo(
    () => mixFeaturedProducts(products, featuredIds),
    [products, featuredIds]
  );

  useEffect(() => {
    const banner = localStorage.getItem("greenhub_custom_banner");
    if (banner) setCustomBanner(banner);

    setProducts(baseProducts);

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

        const serverProducts = data.map((product: any) => ({
          ...product,
          price: getProductPrice(product),
          sellerId: product.seller_id,
          sellerTier: product.seller_tier,
          deliveryOptions: product.delivery_options,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        }));

        setProducts(serverProducts);
      } catch (error: any) {
        console.error("Error loading products from Supabase:", error);
        setProductLoadError(error?.message || "Unable to load server products");

        setProducts(baseProducts);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
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
        const { data, error } = await q.limit(5);
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
                  <div className="absolute top-[48px] left-0 md:-left-[150px] md:w-[calc(100%+150px)] w-full bg-white border border-gray-200 rounded-b-lg shadow-xl z-50 max-h-72 overflow-y-auto">
                    {searchPreviewHits.length === 0 && sanitizeSearchTerm(searchQuery).length < 2 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters for suggestions</div>
                    ) : null}
                    {searchPreviewHits.map((hit) => (
                      <button
                        key={String(hit.id)}
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2 hover:bg-gray-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate(`/products/${hit.id}`);
                          setIsSearchFocused(false);
                        }}
                      >
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-900 line-clamp-1">{String(hit.title ?? "")}</span>
                      </button>
                    ))}
                    {sanitizeSearchTerm(searchQuery).length >= 2 && (
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm font-medium text-[#15803d] hover:bg-green-50 border-t border-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          submitSearch();
                        }}
                      >
                        Search all listings for &quot;{sanitizeSearchTerm(searchQuery)}&quot;
                      </button>
                    )}
                    {sanitizeSearchTerm(searchQuery).length >= 2 && searchPreviewHits.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-500">No title matches yet — try the button above to search descriptions &amp; categories too.</div>
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
                  <span className="hidden md:block text-xs text-gray-400 mt-0.5">{Math.floor(Math.random() * 500) + 120}k ads</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 px-4 py-0 md:px-0">
          
          {/* Primary Navigation Icons (Moved to Top) */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 md:gap-3 mb-6 bg-white py-4 md:py-6 border-b border-gray-200 md:border md:rounded-xl md:shadow-sm">
            <Link to="/" className="flex flex-col items-center justify-center gap-1 md:gap-2 group cursor-pointer text-[#22c55e] min-w-0">
              <HomeIcon className="w-5 h-5 md:w-8 md:h-8 transition-transform group-hover:scale-110 shrink-0" />
              <span className="font-medium text-[10px] md:text-sm text-center leading-tight">Home</span>
            </Link>
            <Link to="/products" className="flex flex-col items-center justify-center gap-1 md:gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e] min-w-0">
              <Search className="w-5 h-5 md:w-8 md:h-8 transition-transform group-hover:scale-110 shrink-0" />
              <span className="font-medium text-[10px] md:text-sm text-center leading-tight">Search</span>
            </Link>
            <Link
              to="/apply-for-job"
              className="flex flex-col items-center justify-center gap-1 md:gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e] min-w-0"
            >
              <span className="text-lg md:text-2xl leading-none" aria-hidden>
                💼
              </span>
              <span className="font-medium text-[10px] md:text-sm text-center leading-tight">Jobs</span>
            </Link>
            <Link to="/seller/products/new" className="flex flex-col items-center justify-center gap-1 md:gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e] min-w-0">
              <PlusCircle className="w-5 h-5 md:w-8 md:h-8 transition-transform group-hover:scale-110 shrink-0" />
              <span className="font-medium text-[10px] md:text-sm text-center leading-tight">Sell</span>
            </Link>
            <Link to="/messages" className="flex flex-col items-center justify-center gap-1 md:gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e] min-w-0">
              <MessageCircle className="w-5 h-5 md:w-8 md:h-8 transition-transform group-hover:scale-110 shrink-0" />
              <span className="font-medium text-[10px] md:text-sm text-center leading-tight">Messages</span>
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Featured Items</h2>
              <Link to="/products" className="text-sm text-[#22c55e]">
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredItemsDisplay.map((product) => (
                <Link key={product.id} to={`/products/${product.id}`}>
                  <ProductCard
                    image={product.image}
                    condition={product.condition}
                    title={product.title}
                    price={product.price}
                    priceDisplay={formatPrice(product.price)}
                    location={product.location}
                    rating={product.rating}
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
          </div>

          {/* Recently Viewed */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-3">Recently Viewed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.slice(0, 2).map((product) => (
                <Link key={product.id} to={`/products/${product.id}`}>
                  <ProductCard
                    image={product.image}
                    condition={product.condition}
                    title={product.title}
                    price={product.price}
                    priceDisplay={formatPrice(product.price)}
                    location={product.location}
                    rating={product.rating}
                  />
                </Link>
              ))}
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
