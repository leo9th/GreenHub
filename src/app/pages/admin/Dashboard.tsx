import { Link } from "react-router";
import { Users, Package, ShoppingBag, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import {  } from "../../data/mockData";
import { useCurrency } from "../../hooks/useCurrency";

export default function AdminDashboard() {
  const formatPrice = useCurrency();
  const stats = [
    { label: "Total Users", value: "12,458", change: "+12%", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Products", value: "3,245", change: "+8%", icon: Package, color: "text-[#22c55e]", bg: "bg-[#22c55e]/10" },
    { label: "Total Orders", value: "8,932", change: "+24%", icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Revenue", value: (45680000), change: "+18%", icon: DollarSign, color: "text-[#eab308]", bg: "bg-[#eab308]/10" },
  ];

  const recentUsers = [
    { id: 1, name: "Amina Yusuf", email: "amina@example.com", joined: "2 hours ago", verified: true },
    { id: 2, name: "Tunde Adebayo", email: "tunde@example.com", joined: "5 hours ago", verified: false },
    { id: 3, name: "Ngozi Okafor", email: "ngozi@example.com", joined: "1 day ago", verified: true },
  ];

  const recentOrders = [
    { id: "ORD-2024-1001", user: "Emeka Nwosu", amount: 450000, status: "pending", date: "10 mins ago" },
    { id: "ORD-2024-1000", user: "Fatima Mohammed", amount: 85000, status: "processing", date: "1 hour ago" },
    { id: "ORD-2024-999", user: "Chidi Okonkwo", amount: 220000, status: "shipped", date: "3 hours ago" },
  ];

  const reportedProducts = [
    { id: 1, title: "iPhone 13 Pro Max 256GB", seller: "John Doe", reports: 3, reason: "Fake product" },
    { id: 2, title: "Nike Air Max Shoes", seller: "Jane Smith", reports: 2, reason: "Misleading description" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-4 max-w-6xl mx-auto">
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Manage and monitor GreenHub platform</p>
        </div>
      </header>

      <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-sm font-medium text-[#22c55e] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/admin/users"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">Manage Users</p>
          </Link>
          <Link
            to="/admin/products"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <Package className="w-8 h-8 text-[#22c55e] mx-auto mb-2" />
            <p className="font-medium text-gray-800">Manage Products</p>
          </Link>
          <Link
            to="/admin/orders"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <ShoppingBag className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">View Orders</p>
          </Link>
          <Link
            to="/admin/reports"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">Reports</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recent Users</h2>
              <Link to="/admin/users" className="text-sm text-[#22c55e] font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{user.name}</p>
                      {user.verified && (
                        <span className="text-[#22c55e] text-xs">✓</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.joined}</p>
                  </div>
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="text-sm text-[#22c55e] font-medium"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recent Orders</h2>
              <Link to="/admin/orders" className="text-sm text-[#22c55e] font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{order.id}</p>
                      <p className="text-sm text-gray-600">{order.user}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{(order.amount)}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reported Products */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Reported Products
            </h2>
            <Link to="/admin/products?filter=reported" className="text-sm text-[#22c55e] font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {reportedProducts.map((product) => (
              <div key={product.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{product.title}</p>
                    <p className="text-sm text-gray-600">by {product.seller}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-medium">
                    {product.reports} reports
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">Reason: {product.reason}</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium">
                    Remove Product
                  </button>
                  <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm font-medium">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
