import { useState } from "react";
import { Link } from "react-router";
import { Search, SlidersHorizontal, Star, MapPin, X } from "lucide-react";

const products = [
  {
    id: 1,
    name: "iPhone 14 Pro Max 256GB",
    price: 850000,
    image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=400",
    rating: 4.8,
    location: "Lagos",
    category: "Electronics",
    condition: "New",
  },
  {
    id: 2,
    name: "Nike Air Max Sneakers Size 42",
    price: 45000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    rating: 4.6,
    location: "Abuja",
    category: "Fashion",
    condition: "New",
  },
  {
    id: 3,
    name: "Samsung 55\" 4K Smart TV",
    price: 320000,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400",
    rating: 4.7,
    location: "Port Harcourt",
    category: "Electronics",
    condition: "Used",
  },
  {
    id: 4,
    name: "Ergonomic Office Desk Chair",
    price: 65000,
    image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=400",
    rating: 4.5,
    location: "Lagos",
    category: "Home",
    condition: "New",
  },
  {
    id: 5,
    name: "MacBook Pro 14\" M2 Chip",
    price: 1200000,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400",
    rating: 4.9,
    location: "Lagos",
    category: "Electronics",
    condition: "New",
  },
  {
    id: 6,
    name: "Sony PlayStation 5 Console",
    price: 450000,
    image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400",
    rating: 4.8,
    location: "Abuja",
    category: "Electronics",
    condition: "Used",
  },
];

export function ProductListing() {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");

  return (
    <div className="max-w-7xl mx-auto">
      <div className="sticky top-0 bg-white border-b border-border p-4 space-y-3 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-white rounded-lg"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          <select className="flex-1 px-4 py-2 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]">
            <option>Sort: Relevance</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Newest First</option>
            <option>Rating: High to Low</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border-b border-border p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-foreground">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="home">Home & Furniture</option>
              <option value="books">Books</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">Condition</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCondition(selectedCondition === "new" ? "" : "new")}
                className={`flex-1 py-2 rounded-lg border ${
                  selectedCondition === "new"
                    ? "border-[#22c55e] bg-[#22c55e]/10 text-[#22c55e]"
                    : "border-border text-foreground"
                }`}
              >
                New
              </button>
              <button
                onClick={() => setSelectedCondition(selectedCondition === "used" ? "" : "used")}
                className={`flex-1 py-2 rounded-lg border ${
                  selectedCondition === "used"
                    ? "border-[#22c55e] bg-[#22c55e]/10 text-[#22c55e]"
                    : "border-border text-foreground"
                }`}
              >
                Used
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">Price Range</label>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Any Price</option>
              <option value="0-50000">₦0 - ₦50,000</option>
              <option value="50000-200000">₦50,000 - ₦200,000</option>
              <option value="200000-500000">₦200,000 - ₦500,000</option>
              <option value="500000+">₦500,000+</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-muted text-foreground rounded-lg">
              Clear All
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 py-2 bg-[#22c55e] text-white rounded-lg"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          {products.length} products found
        </p>

        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="bg-white rounded-lg border border-border hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-muted relative">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded text-xs">
                  {product.condition}
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-sm text-foreground line-clamp-2 mb-1">
                  {product.name}
                </h4>
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-[#eab308] fill-[#eab308]" />
                  <span className="text-xs text-muted-foreground">{product.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3" />
                  <span>{product.location}</span>
                </div>
                <p className="text-[#22c55e]">₦{product.price.toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
