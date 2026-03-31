import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Plus, Search, MoreVertical, Edit, Trash2, Eye, EyeOff, TrendingUp } from "lucide-react";
import {  } from "../../data/mockData";
import { useCurrency } from "../../hooks/useCurrency";

export default function SellerProducts() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showActions, setShowActions] = useState<number | null>(null);

  const products = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200",
      title: "iPhone 13 Pro Max 256GB - Pacific Blue",
      price: 450000,
      views: 234,
      status: "active",
      stock: 1,
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200",
      title: "Samsung Galaxy S21 Ultra 5G",
      price: 220000,
      views: 156,
      status: "active",
      stock: 2,
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200",
      title: "Sony WH-1000XM4 Wireless Headphones",
      price: 85000,
      views: 89,
      status: "inactive",
      stock: 0,
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
      title: "Nike Air Max 270 Shoes - Size 42",
      price: 25000,
      views: 312,
      status: "active",
      stock: 3,
    },
  ];

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (productId: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      // Delete logic here
      console.log("Delete product:", productId);
    }
    setShowActions(null);
  };

  const toggleStatus = (productId: number) => {
    // Toggle product status logic
    console.log("Toggle status:", productId);
    setShowActions(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">My Products</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-sm text-gray-600">Total Products</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-[#22c55e]">
              {products.filter(p => p.status === "active").length}
            </p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-500">
              {products.filter(p => p.status === "inactive").length}
            </p>
            <p className="text-sm text-gray-600">Inactive</p>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="px-4 py-4 max-w-7xl mx-auto space-y-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex gap-3">
              <Link to={`/products/${product.id}`} className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${product.id}`}>
                  <h3 className="font-medium text-gray-800 mb-1 line-clamp-2">{product.title}</h3>
                </Link>
                <p className="text-lg font-bold text-gray-900 mb-2">{(product.price)}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{product.views} views</span>
                  <span className={product.stock > 0 ? "text-[#22c55e]" : "text-red-500"}>
                    {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                  </span>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowActions(showActions === product.id ? null : product.id)}
                  className="p-2"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>

                {showActions === product.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowActions(null)}
                    />
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-40">
                      <Link
                        to={`/seller/products/edit/${product.id}`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
                      <Link
                        to={`/seller/advertise?productId=${product.id}`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-[#f97316]"
                      >
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Boost Ad</span>
                      </Link>
                      <button
                        onClick={() => toggleStatus(product.id)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 w-full"
                      >
                        {product.status === "active" ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span className="text-sm">Deactivate</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span className="text-sm">Activate</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {product.status === "inactive" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  This product is inactive and not visible to buyers
                </p>
              </div>
            )}
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No products found</h3>
            <p className="text-gray-600 text-sm mb-6">
              {searchQuery ? "Try a different search term" : "Start by adding your first product"}
            </p>
          </div>
        )}
      </div>

      {/* Add Product Button */}
      <Link
        to="/seller/products/add"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#22c55e] rounded-full shadow-lg flex items-center justify-center text-white z-30"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
