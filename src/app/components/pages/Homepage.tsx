import { Link } from "react-router";
import { Search, Smartphone, Laptop, Watch, Shirt, Sofa, Book, Star, MapPin } from "lucide-react";

const categories = [
  { name: "Electronics", icon: Smartphone, color: "bg-blue-100", iconColor: "text-blue-600" },
  { name: "Fashion", icon: Shirt, color: "bg-pink-100", iconColor: "text-pink-600" },
  { name: "Home", icon: Sofa, color: "bg-purple-100", iconColor: "text-purple-600" },
  { name: "Books", icon: Book, color: "bg-yellow-100", iconColor: "text-yellow-600" },
  { name: "Laptops", icon: Laptop, color: "bg-green-100", iconColor: "text-green-600" },
  { name: "Watches", icon: Watch, color: "bg-red-100", iconColor: "text-red-600" },
];

const featuredProducts = [
  {
    id: 1,
    name: "iPhone 14 Pro Max",
    price: 850000,
    image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=400",
    rating: 4.8,
    location: "Lagos",
    seller: "TechHub Store",
  },
  {
    id: 2,
    name: "Nike Air Max Sneakers",
    price: 45000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    rating: 4.6,
    location: "Abuja",
    seller: "ShoeLand",
  },
  {
    id: 3,
    name: "Samsung 55\" Smart TV",
    price: 320000,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400",
    rating: 4.7,
    location: "Port Harcourt",
    seller: "ElectroMart",
  },
  {
    id: 4,
    name: "Office Desk Chair",
    price: 65000,
    image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=400",
    rating: 4.5,
    location: "Lagos",
    seller: "Furniture Plus",
  },
];

export function Homepage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="p-4 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for products..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>

        <div className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] rounded-xl p-6 text-white">
          <h2 className="text-xl mb-2">Shop Trusted Sellers</h2>
          <p className="text-sm opacity-90 mb-4">
            Buy and sell with confidence on Nigeria's green marketplace
          </p>
          <Link
            to="/products"
            className="inline-block bg-white text-[#22c55e] px-6 py-2 rounded-lg"
          >
            Browse Products
          </Link>
        </div>

        <div>
          <h3 className="text-foreground mb-3">Categories</h3>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.name}
                  to={`/products?category=${category.name.toLowerCase()}`}
                  className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-border hover:border-[#22c55e] transition-colors"
                >
                  <div className={`w-12 h-12 ${category.color} rounded-full flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${category.iconColor}`} />
                  </div>
                  <span className="text-xs text-center text-foreground">{category.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground">Featured Products</h3>
            <Link to="/products" className="text-sm text-[#22c55e]">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="bg-white rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-muted relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
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

        <div className="bg-[#eab308]/10 border border-[#eab308]/20 rounded-lg p-4">
          <h3 className="text-foreground mb-2">Become a Seller</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Start selling your products and reach thousands of buyers across Nigeria
          </p>
          <Link
            to="/seller/dashboard"
            className="inline-block bg-[#eab308] text-white px-6 py-2 rounded-lg"
          >
            Start Selling
          </Link>
        </div>
      </div>
    </div>
  );
}
