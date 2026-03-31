import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Filter, ArrowLeft, ChevronDown, X, Star, MapPin, BadgeCheck } from "lucide-react";
import {  categories, nigerianStates  } from "../data/mockData";
import { useCurrency } from "../hooks/useCurrency";

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const formatPrice = useCurrency();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get("category") || "all");

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && cat !== selectedCategory) {
      setSelectedCategory(cat);
    }
  }, [searchParams]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    if (val === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", val);
    }
    setSearchParams(searchParams);
  };
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const products = [
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
      sellerTier: "blue"
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
      sellerTier: "standard"
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
      sellerTier: "crown"
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
      sellerTier: "unverified"
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
      sellerTier: "blue"
    },
  ];

  const conditions = ["New", "Like New", "Good", "Fair"];
  const priceRanges = [
    { label: "Under ₦10,000", value: "0-10000" },
    { label: "₦10,000 - ₦50,000", value: "10000-50000" },
    { label: "₦50,000 - ₦100,000", value: "50000-100000" },
    { label: "₦100,000 - ₦500,000", value: "100000-500000" },
    { label: "Above ₦500,000", value: "500000-999999999" },
  ];

  const sellerTierRank: Record<string, number> = {
    'crown': 4,
    'blue': 3,
    'standard': 2,
    'unverified': 1
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'crown': return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-yellow-500 drop-shadow-sm" title="Crown Verified" />;
      case 'blue': return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-blue-500 drop-shadow-sm" title="Blue Verified" />;
      case 'standard': return <BadgeCheck className="w-[18px] h-[18px] ml-1 text-white fill-green-500 drop-shadow-sm" title="Standard Verified" />;
      default: return null;
    }
  };

  const filteredProducts = products.filter((product) => {
    if (selectedCategory !== "all" && product.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (selectedCondition !== "all" && product.condition !== selectedCondition) return false;
    if (searchQuery && !product.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    // Primary sorting: verification tier ranking order
    const rankDiff = (sellerTierRank[b.sellerTier || 'unverified'] || 0) - (sellerTierRank[a.sellerTier || 'unverified'] || 0);
    if (rankDiff !== 0) return rankDiff;

    // Secondary sorting handling 
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    if (sortBy === "rating") return b.rating - a.rating;
    
    // Default recency (if tiers match)
    return b.id - a.id;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
            </div>
            <button
              onClick={() => setShowFilters(true)}
              className="p-2 bg-[#22c55e] rounded-lg text-white"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Active Filters */}
          {(selectedCategory !== "all" || selectedCondition !== "all") && (
            <div className="flex gap-2 flex-wrap">
              {selectedCategory !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{categories.find((c) => c.id === selectedCategory)?.name}</span>
                  <button onClick={() => handleCategoryChange("all")}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedCondition !== "all" && (
                <div className="flex items-center gap-1 bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded text-xs">
                  <span>{selectedCondition}</span>
                  <button onClick={() => setSelectedCondition("all")}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Sort Options */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <span className="text-sm text-gray-600">{filteredProducts.length} products</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm font-medium text-[#22c55e] bg-transparent focus:outline-none"
            >
              <option value="recent">Most Recent</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredProducts.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-square bg-gray-100">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 bg-[#22c55e] text-white text-xs px-2 py-1 rounded">
                  {product.condition}
                </span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-800 mb-1 line-clamp-2 flex items-center">
                  <span className="truncate">{product.title}</span>
                  {getTierIcon(product.sellerTier)}
                </h3>
                <p className="text-lg font-bold text-gray-900 mb-1">{(product.price)}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <MapPin className="w-3 h-3" />
                  <span className="line-clamp-1">{product.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#eab308] text-[#eab308]" />
                  <span className="text-xs text-gray-600">{product.rating}</span>
                  <span className="text-xs text-gray-400">({product.reviews})</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No products found</h3>
            <p className="text-gray-600 text-sm">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
              <button onClick={() => setShowFilters(false)}>
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-4">
              {/* Category */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Category</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === "all"}
                      onChange={() => handleCategoryChange("all")}
                      className="text-[#22c55e] focus:ring-[#22c55e]"
                    />
                    <span className="text-sm text-gray-700">All Categories</span>
                  </label>
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="category"
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

              {/* Condition */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Condition</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="condition"
                      checked={selectedCondition === "all"}
                      onChange={() => setSelectedCondition("all")}
                      className="text-[#22c55e] focus:ring-[#22c55e]"
                    />
                    <span className="text-sm text-gray-700">All Conditions</span>
                  </label>
                  {conditions.map((condition) => (
                    <label key={condition} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="condition"
                        checked={selectedCondition === condition}
                        onChange={() => setSelectedCondition(condition)}
                        className="text-[#22c55e] focus:ring-[#22c55e]"
                      />
                      <span className="text-sm text-gray-700">{condition}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Price Range</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="price"
                      checked={priceRange === "all"}
                      onChange={() => setPriceRange("all")}
                      className="text-[#22c55e] focus:ring-[#22c55e]"
                    />
                    <span className="text-sm text-gray-700">All Prices</span>
                  </label>
                  {priceRanges.map((range) => (
                    <label key={range.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="price"
                        checked={priceRange === range.value}
                        onChange={() => setPriceRange(range.value)}
                        className="text-[#22c55e] focus:ring-[#22c55e]"
                      />
                      <span className="text-sm text-gray-700">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Location</h3>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  <option value="all">All States</option>
                  {nigerianStates.map((state) => (
                    <option key={state.code} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleCategoryChange("all");
                    setSelectedCondition("all");
                    setPriceRange("all");
                    setSelectedState("all");
                  }}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-medium"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
