import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Search, AlertCircle, CheckCircle, XCircle, MoreVertical } from "lucide-react";
import {  } from "../../data/mockData";
import { useCurrency } from "../../hooks/useCurrency";

export default function AdminProducts() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "reported" | "suspended">("all");
  const [showActions, setShowActions] = useState<number | null>(null);

  const products = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200",
      title: "iPhone 13 Pro Max 256GB - Pacific Blue",
      seller: "Chidi Okonkwo",
      price: 450000,
      status: "active",
      reports: 0,
      views: 234,
      posted: "2024-03-20",
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200",
      title: "Samsung Galaxy S21 Ultra 5G",
      seller: "Amina Yusuf",
      price: 220000,
      status: "active",
      reports: 0,
      views: 156,
      posted: "2024-03-22",
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200",
      title: "Sony WH-1000XM4 Wireless Headphones",
      seller: "Tunde Adebayo",
      price: 85000,
      status: "reported",
      reports: 3,
      views: 89,
      posted: "2024-03-18",
      reportReason: "Fake product",
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
      title: "Nike Air Max 270 Shoes - Size 42",
      seller: "Ngozi Okafor",
      price: 25000,
      status: "reported",
      reports: 2,
      views: 312,
      posted: "2024-03-15",
      reportReason: "Misleading description",
    },
    {
      id: 5,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200",
      title: "Timex Classic Watch",
      seller: "Emeka Nwosu",
      price: 15000,
      status: "suspended",
      reports: 5,
      views: 45,
      posted: "2024-03-10",
      reportReason: "Counterfeit",
    },
  ];

  const filteredProducts = products.filter((product) => {
    if (searchQuery && !product.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !product.seller.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === "active" && product.status !== "active") return false;
    if (filter === "reported" && product.status !== "reported") return false;
    if (filter === "suspended" && product.status !== "suspended") return false;
    return true;
  });

  const handleApprove = (productId: number) => {
    console.log("Approve product:", productId);
    setShowActions(null);
  };

  const handleSuspend = (productId: number) => {
    if (confirm("Are you sure you want to suspend this product?")) {
      console.log("Suspend product:", productId);
    }
    setShowActions(null);
  };

  const handleDelete = (productId: number) => {
    if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      console.log("Delete product:", productId);
    }
    setShowActions(null);
  };

  const getStatusBadge = (product: typeof products[0]) => {
    if (product.status === "suspended") {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Suspended
        </span>
      );
    }
    if (product.status === "reported") {
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {product.reports} Reports
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Product Management</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products by title or seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 max-w-6xl mx-auto flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "all" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "active" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Active ({products.filter(p => p.status === "active").length})
          </button>
          <button
            onClick={() => setFilter("reported")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "reported" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Reported ({products.filter(p => p.status === "reported").length})
          </button>
          <button
            onClick={() => setFilter("suspended")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "suspended" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Suspended ({products.filter(p => p.status === "suspended").length})
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="px-4 py-4 max-w-6xl mx-auto">
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stats</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 line-clamp-2">{product.title}</p>
                          <p className="text-sm text-gray-600">Posted {product.posted}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-800">{product.seller}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-800">{(product.price)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-800">{product.views} views</p>
                      {product.reports > 0 && (
                        <p className="text-sm text-red-600">{product.reports} reports</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(product)}
                      {product.reportReason && (
                        <p className="text-xs text-gray-600 mt-1">{product.reportReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === product.id ? null : product.id)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>

                        {showActions === product.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowActions(null)}
                            />
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-40">
                              <Link
                                to={`/products/${product.id}`}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm"
                              >
                                View Product
                              </Link>
                              {product.status === "reported" && (
                                <button
                                  onClick={() => handleApprove(product.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-[#22c55e] w-full text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                              )}
                              {product.status !== "suspended" ? (
                                <button
                                  onClick={() => handleSuspend(product.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 w-full text-sm"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApprove(product.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-[#22c55e] w-full text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Unsuspend
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 w-full text-sm"
                              >
                                <XCircle className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
