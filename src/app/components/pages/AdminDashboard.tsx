import { Users, Package, DollarSign, TrendingUp, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const platformData = [
  { month: "Jan", revenue: 1250000, orders: 45, users: 120 },
  { month: "Feb", revenue: 1680000, orders: 62, users: 180 },
  { month: "Mar", revenue: 2100000, orders: 78, users: 245 },
];

const recentUsers = [
  { id: 1, name: "John Doe", email: "john@email.com", role: "Buyer", status: "active", joined: "Mar 24" },
  { id: 2, name: "Jane Smith", email: "jane@email.com", role: "Seller", status: "active", joined: "Mar 23" },
  { id: 3, name: "Mike Johnson", email: "mike@email.com", role: "Buyer", status: "pending", joined: "Mar 22" },
];

const flaggedProducts = [
  {
    id: 1,
    name: "iPhone 14 Pro Max",
    seller: "TechHub Store",
    reason: "Price verification needed",
    image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200",
  },
  {
    id: 2,
    name: "Nike Air Max",
    seller: "ShoeLand",
    reason: "Authenticity check",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
  },
];

export function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white p-6">
        <h1 className="text-2xl mb-2">Admin Dashboard</h1>
        <p className="text-sm opacity-90">GreenHub Platform Management</p>
      </div>

      <div className="p-4 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#22c55e]" />
            </div>
            <p className="text-2xl text-foreground mb-1">545</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-xs text-[#22c55e] mt-1">+65 this month</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl text-foreground mb-1">1,234</p>
            <p className="text-xs text-muted-foreground">Total Products</p>
            <p className="text-xs text-blue-600 mt-1">+89 this month</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-[#eab308]" />
            </div>
            <p className="text-2xl text-foreground mb-1">₦5.03M</p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xs text-[#eab308] mt-1">+25% growth</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl text-foreground mb-1">185</p>
            <p className="text-xs text-muted-foreground">Orders Today</p>
            <p className="text-xs text-purple-600 mt-1">12 pending</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-foreground mb-3">Platform Revenue</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={platformData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-foreground mb-3">Monthly Activity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={platformData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="orders" fill="#22c55e" radius={[8, 8, 0, 0]} />
              <Bar dataKey="users" fill="#eab308" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h2 className="text-foreground mb-3">Recent Users</h2>
          <div className="space-y-2">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-lg border border-border p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#22c55e] flex items-center justify-center">
                    <span className="text-white">{user.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      user.status === "active"
                        ? "bg-[#22c55e]/10 text-[#22c55e]"
                        : "bg-[#eab308]/10 text-[#eab308]"
                    }`}
                  >
                    {user.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{user.joined}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-foreground">Flagged Products</h2>
          </div>
          <div className="space-y-3">
            {flaggedProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-red-200 p-3 flex gap-3"
              >
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground mb-1">{product.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Seller: {product.seller}
                  </p>
                  <p className="text-xs text-red-600">{product.reason}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="text-[#22c55e]">
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button className="text-red-600">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 bg-white rounded-lg border border-border hover:border-[#22c55e] transition-colors">
            <Users className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">Manage Users</p>
          </button>
          <button className="p-4 bg-white rounded-lg border border-border hover:border-[#22c55e] transition-colors">
            <Package className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">Review Products</p>
          </button>
          <button className="p-4 bg-white rounded-lg border border-border hover:border-[#22c55e] transition-colors">
            <TrendingUp className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">Analytics</p>
          </button>
          <button className="p-4 bg-white rounded-lg border border-border hover:border-[#22c55e] transition-colors">
            <AlertCircle className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-foreground">Reports</p>
          </button>
        </div>
      </div>
    </div>
  );
}
