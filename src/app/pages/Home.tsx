import { Link } from "react-router";
import { Search, ChevronDown, Star, Globe, Home as HomeIcon, PlusCircle, MessageCircle, Zap } from "lucide-react";
import { categories } from "../data/mockData";
import { getMockProductsForRegion } from "../data/mockData";
import { useRegion, regions } from "../context/RegionContext";
import { useCurrency } from "../hooks/useCurrency";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ProductCard } from "../components/cards/ProductCard";

export default function Home() {
  const { activeRegion, setRegion } = useRegion();
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const baseProducts = getMockProductsForRegion(activeRegion.id as "NG" | "US" | "CN");
  const CUSTOM_PRODUCTS_KEY = "greenhub-custom-products";

  const getLocalProducts = () => {
    const rawProducts = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
    return rawProducts ? JSON.parse(rawProducts) : [];
  };

  const mergeUniqueProducts = (productLists: any[][]) => {
    const productMap = new Map<string, any>();
    productLists.flat().forEach((product) => {
      const key = product?.id?.toString();
      if (!key) return;
      if (!productMap.has(key)) productMap.set(key, product);
    });
    return Array.from(productMap.values());
  };

  const applyFeaturedProduct = (products: any[]) => {
    const featId = localStorage.getItem("greenhub_featured_product");
    if (!featId) {
      setFeaturedProduct(null);
      return products;
    }

    const found = products.find((p: any) => p.id?.toString() === featId);
    if (!found) {
      setFeaturedProduct(null);
      return products;
    }

    setFeaturedProduct(found);
    return [found, ...products.filter((p: any) => p.id?.toString() !== featId)];
  };

  // Custom Ad State
  const [customBanner, setCustomBanner] = useState<string | null>(null);
  const [featuredProduct, setFeaturedProduct] = useState<any | null>(null);
  const [products, setProducts] = useState(baseProducts as Array<any>);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  useEffect(() => {
    const banner = localStorage.getItem("greenhub_custom_banner");
    if (banner) setCustomBanner(banner);

    const localProducts = getLocalProducts();
    const initialProducts = applyFeaturedProduct(mergeUniqueProducts([localProducts, baseProducts]));
    setProducts(initialProducts);

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductLoadError(null);

      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const serverProducts = data.map((product: any) => ({
          ...product,
          sellerId: product.seller_id,
          sellerTier: product.seller_tier,
          deliveryOptions: product.delivery_options,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        }));

        const nextProducts = applyFeaturedProduct(
          mergeUniqueProducts([serverProducts, localProducts, baseProducts])
        );

        setProducts(nextProducts);
      } catch (error: any) {
        console.error("Error loading products from Supabase:", error);
        setProductLoadError(error?.message || "Unable to load server products");

        const nextProducts = applyFeaturedProduct(
          mergeUniqueProducts([localProducts, baseProducts])
        );

        setProducts(nextProducts);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, [activeRegion.id]);

  const searchSuggestions = [
    "Home & Garden",
    "Home theater systems",
    "Honda Accord",
    "Honda Civic",
    "House for rent",
    "Hp Laptops",
    "Generators",
    "iPhone 13 Pro",
    "Nike Air Force",
    "Samsung Galaxy S22"
  ];

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

          <div className="flex items-center gap-2 md:gap-0 w-full max-w-3xl mx-auto">
            {/* Desktop Location Dropdown */}
            <div className="relative hidden md:flex">
              <button 
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
                      onClick={() => {
                        setRegion(r.id);
                        setShowRegionDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-0 ${activeRegion.id === r.id ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700'}`}
                    >
                      {r.name} ({r.currencyCode})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1 flex flex-col justify-center">
              <div className="w-full relative h-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="I am looking for..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="w-full h-full pl-10 pr-4 py-3 focus:outline-none text-gray-900 rounded-lg md:rounded-none"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {isSearchFocused && searchQuery.length > 0 && (
                <div className="absolute top-[48px] left-0 md:-left-[150px] md:w-[calc(100%+150px)] w-full bg-white border border-gray-200 rounded-b-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {searchSuggestions
                    .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((suggestion, index) => {
                      const matchIndex = suggestion.toLowerCase().indexOf(searchQuery.toLowerCase());
                      const beforeMatch = suggestion.substring(0, matchIndex);
                      const matchText = suggestion.substring(matchIndex, matchIndex + searchQuery.length);
                      const afterMatch = suggestion.substring(matchIndex + searchQuery.length);

                      return (
                        <div 
                          key={index}
                          className="px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2"
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setIsSearchFocused(false);
                          }}
                        >
                          <Search className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <span className="text-gray-800">{beforeMatch}</span>
                            <span className="text-gray-400">{matchText}</span>
                            <span className="font-semibold text-gray-900">{afterMatch}</span>
                          </div>
                        </div>
                      );
                    })}
                  {searchSuggestions.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">No matching suggestions</div>
                  )}
                </div>
              )}
            </div>
            {/* Desktop Search Button */}
            <button className="hidden md:flex items-center justify-center bg-[#15803d] text-white px-8 py-3 rounded-r-lg font-semibold hover:bg-[#166534] transition-colors">
              <Search className="w-5 h-5 mr-2 hidden md:block" />
              Search
            </button>
          </div>
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
            <Link to="/messages" className="flex flex-col items-center justify-center gap-2 group cursor-pointer text-gray-600 hover:text-[#22c55e]">
              <MessageCircle className="w-6 h-6 md:w-8 md:h-8 transition-transform group-hover:scale-110" />
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Featured Items</h2>
              <Link to="/products" className="text-sm text-[#22c55e]">
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
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
                      featuredProduct?.id === product.id ? (
                        <span className="bg-yellow-400 text-yellow-900 text-[10px] md:text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                          <Zap className="w-3 h-3 fill-current" />
                          Ad
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
