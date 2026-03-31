import { Link } from "react-router";
import { Package, User as UserIcon } from "lucide-react";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuth } from "../../context/AuthContext";

export default function SellerDashboard() {
  const formatPrice = useCurrency();
  const { profile, user: authUser } = useAuth();
  
  const userName = profile?.full_name || authUser?.user_metadata?.full_name || "GreenHub Seller";
  const userPhone = profile?.phone || authUser?.user_metadata?.phone || "ADD PHONE NUMBER";

  const recentOrders = [
    {
      id: "ORD-2024-101",
      buyer: "Amina Yusuf",
      product: "iPhone 13 Pro Max 256GB - Free Delivery",
      amount: 450000,
      status: "pending",
      date: "2 hours ago",
    },
    {
      id: "ORD-2024-100",
      buyer: "Tunde Adebayo",
      product: "Samsung Galaxy S21 Ultra used",
      amount: 220000,
      status: "processing",
      date: "5 hours ago",
    },
    {
      id: "ORD-2024-099",
      buyer: "Ngozi Okafor",
      product: "Sony Noise Cancelling Headphones",
      amount: 85000,
      status: "shipped",
      date: "1 day ago",
    },
  ];

  const earnings = {
    thisMonth: 850000,
    lastMonth: 720000,
    pending: 125000,
    available: 725000,
  };

  return (
    <div className="min-h-screen bg-[#f2f4f8] pb-10">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* Left Sidebar */}
        <div className="w-full md:w-[280px] flex-shrink-0">
          <div className="bg-transparent">
            {/* User Card */}
            <div className="flex flex-col items-center justify-center p-6 mb-2">
              <div className="w-[100px] h-[100px] bg-[#b2dfdb] rounded-full flex items-center justify-center mb-4">
                <UserIcon className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-xl font-medium text-gray-800 text-center">{userName}</h2>
              <Link to="/settings/profile/edit" className="text-[11px] font-bold text-gray-400 mt-2 tracking-wider uppercase hover:text-[#22c55e] transition-colors">
                {userPhone}
              </Link>
            </div>

            {/* Sidebar Links */}
            <div className="space-y-1">
              <Link to="/seller/products/add" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">➕</span>
                <span className="text-[15px] font-medium text-gray-600">Add New Product</span>
              </Link>
              <Link to="/profile" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">👥</span>
                <span className="text-[15px] font-medium text-gray-600">Followers</span>
              </Link>
              <Link to="/seller/products" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">📋</span>
                <span className="text-[15px] font-medium text-gray-600">My adverts</span>
              </Link>
              <Link to="/messages" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">💬</span>
                <span className="text-[15px] font-medium text-gray-600">Feedback</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Main Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent min-h-[600px]">
            {/* Main Content Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h1 className="text-xl font-medium text-gray-800">Dashboard Insights</h1>
              <div className="flex items-center gap-3">
                <span className="hidden md:inline-block bg-[#b2dfdb] text-[#00695c] px-3 py-1 rounded-full text-xs font-bold mr-1">
                  Orders ({recentOrders.length})
                </span>
                <Link to="/seller/products/add" className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold flex items-center gap-2 transition-colors">
                  <span className="text-lg leading-none">+</span> Add Product
                </Link>
              </div>
            </div>

            {/* Main Content Body */}
            <div className="p-6">
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <Link 
                    to={`/orders/${order.id}`}
                    key={order.id} 
                    className="flex gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 rounded-lg"
                  >
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <Package className="w-8 h-8 text-gray-300" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="font-semibold text-[15px] text-gray-900 line-clamp-2">{order.product}</h3>
                      <p className="text-[#22c55e] font-bold text-lg mt-1">{formatPrice(order.amount)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 flex items-center h-5 rounded-sm uppercase tracking-wider font-semibold">{order.status}</span>
                        <span className="text-[12px] text-gray-400">• {order.date}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Minimal Earnings Stats */}
              <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-bold">This Month</p>
                  <p className="text-lg font-bold text-gray-800">{formatPrice(earnings.thisMonth)}</p>
                </div>
                <div className="text-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-bold">Last Month</p>
                  <p className="text-lg font-bold text-gray-800">{formatPrice(earnings.lastMonth)}</p>
                </div>
                <div className="text-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-bold">Pending</p>
                  <p className="text-lg font-bold text-orange-500">{formatPrice(earnings.pending)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#22c55e]/5 hover:bg-[#22c55e]/10 transition-colors cursor-pointer border border-[#22c55e]/20">
                  <p className="text-[11px] text-[#22c55e] mb-1.5 uppercase tracking-wider font-bold">Withdraw</p>
                  <p className="text-lg font-bold text-[#22c55e]">{formatPrice(earnings.available)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
