import { Link } from "react-router";
import { Plus, TrendingUp, Package, DollarSign, Eye, Edit, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const salesData = [
  { month: "Jan", sales: 450000 },
  { month: "Feb", sales: 680000 },
  { month: "Mar", sales: 920000 },
];

const products = [
  {
    id: 1,
    name: "iPhone 14 Pro Max 256GB",
    price: 850000,
    stock: 3,
    sold: 12,
    views: 234,
    image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200",
    status: "active",
  },
  {
    id: 2,
    name: "Samsung 55\" Smart TV",
    price: 320000,
    stock: 0,
    sold: 8,
    views: 156,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=200",
    status: "out_of_stock",
  },
  {
    id: 3,
    name: "MacBook Pro 14\" M2",
    price: 1200000,
    stock: 5,
    sold: 6,
    views: 189,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
    status: "active",
  },
];

const recentOrders = [
  {
    id: "ORD-001",
    product: "iPhone 14 Pro Max",
    buyer: "John Doe",
    amount: 850000,
    status: "pending",
    date: "Mar 25, 2026",
  },
  {
    id: "ORD-002",
    product: "Samsung Smart TV",
    buyer: "Jane Smith",
    amount: 320000,
    status: "shipped",
    date: "Mar 24, 2026",
  },
];

export function SellerDashboard() {
  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white p-6">
        <h1 className="text-2xl mb-2">Seller Dashboard</h1>
        <p className="text-sm opacity-90">TechHub Store</p>
      </div>

      <div className="p-4 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-[#22c55e]" />
            </div>
            <p className="text-2xl text-foreground mb-1">₦2.05M</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl text-foreground mb-1">26</p>
            <p className="text-xs text-muted-foreground">Products Sold</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#eab308]" />
            </div>
            <p className="text-2xl text-foreground mb-1">579</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-foreground mb-3">Sales Overview</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sales" fill="#22c55e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground">My Products</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-white rounded-lg">
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-border p-3 flex gap-3"
              >
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm text-foreground line-clamp-1 mb-1">
                    {product.name}
                  </h3>
                  <p className="text-[#22c55e] mb-2">₦{product.price.toLocaleString()}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Stock: {product.stock}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {product.views}
                    </span>
                    <span>Sold: {product.sold}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="text-blue-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Recent Orders</h2>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground">{order.id}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      order.status === "pending"
                        ? "bg-[#eab308]/10 text-[#eab308]"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {order.status === "pending" ? "Pending" : "Shipped"}
                  </span>
                </div>
                <p className="text-sm text-foreground mb-1">{order.product}</p>
                <p className="text-xs text-muted-foreground mb-2">Buyer: {order.buyer}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[#22c55e]">₦{order.amount.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{order.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/orders"
            className="p-4 bg-white rounded-lg border border-border text-center hover:border-[#22c55e] transition-colors"
          >
            <Package className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">Manage Orders</p>
          </Link>
          <Link
            to="/messages"
            className="p-4 bg-white rounded-lg border border-border text-center hover:border-[#22c55e] transition-colors"
          >
            <TrendingUp className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">View Analytics</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
