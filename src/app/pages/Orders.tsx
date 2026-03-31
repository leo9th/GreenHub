import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Package, Clock, Truck, CheckCircle, X } from "lucide-react";
import {  } from "../data/mockData";
import { useCurrency } from "../hooks/useCurrency";

type OrderStatus = "all" | "pending" | "processing" | "shipped" | "delivered";

export default function Orders() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OrderStatus>("all");

  const orders = [
    {
      id: "ORD-2024-001",
      date: "2024-03-20",
      status: "delivered",
      total: 555500,
      items: [
        {
          image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200",
          title: "iPhone 13 Pro Max 256GB",
          quantity: 1,
          price: 450000,
        },
      ],
    },
    {
      id: "ORD-2024-002",
      date: "2024-03-22",
      status: "shipped",
      total: 75000,
      items: [
        {
          image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
          title: "Nike Air Max 270 Shoes",
          quantity: 2,
          price: 25000,
        },
      ],
    },
    {
      id: "ORD-2024-003",
      date: "2024-03-23",
      status: "processing",
      total: 85000,
      items: [
        {
          image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200",
          title: "Sony WH-1000XM4 Headphones",
          quantity: 1,
          price: 85000,
        },
      ],
    },
    {
      id: "ORD-2024-004",
      date: "2024-03-24",
      status: "pending",
      total: 15000,
      items: [
        {
          image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200",
          title: "Timex Classic Watch",
          quantity: 1,
          price: 15000,
        },
      ],
    },
  ];

  const tabs = [
    { id: "all" as OrderStatus, label: "All", icon: Package },
    { id: "pending" as OrderStatus, label: "Pending", icon: Clock },
    { id: "processing" as OrderStatus, label: "Processing", icon: Package },
    { id: "shipped" as OrderStatus, label: "Shipped", icon: Truck },
    { id: "delivered" as OrderStatus, label: "Delivered", icon: CheckCircle },
  ];

  const filteredOrders = activeTab === "all"
    ? orders
    : orders.filter(order => order.status === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "processing":
        return <Package className="w-4 h-4" />;
      case "shipped":
        return <Truck className="w-4 h-4" />;
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">My Orders</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="px-4 flex gap-6 max-w-7xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#22c55e] text-[#22c55e]"
                    : "border-transparent text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4 max-w-7xl mx-auto space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No orders found</h3>
            <p className="text-gray-600 text-sm mb-6">
              {activeTab === "all"
                ? "You haven't placed any orders yet"
                : `You don't have any ${activeTab} orders`}
            </p>
            <Link
              to="/products"
              className="inline-block px-6 py-3 bg-[#22c55e] text-white rounded-lg font-medium"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{order.id}</p>
                  <p className="text-sm text-gray-600">{order.date}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              {order.items.map((item, index) => (
                <div key={index} className="flex gap-3 mb-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{(item.price)}</p>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-bold text-[#22c55e]">{(order.total)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
