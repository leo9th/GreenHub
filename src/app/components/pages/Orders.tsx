import { useState } from "react";
import { Link } from "react-router";
import { Package, Clock, CheckCircle2, XCircle, MapPin, Truck } from "lucide-react";

const orders = [
  {
    id: "ORD-2026-0324-001",
    date: "March 24, 2026",
    status: "in_transit",
    total: 895000,
    items: [
      {
        name: "iPhone 14 Pro Max 256GB",
        quantity: 1,
        price: 850000,
        image: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200",
      },
      {
        name: "Nike Air Max Sneakers",
        quantity: 1,
        price: 45000,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
      },
    ],
    tracking: {
      courier: "GIGL Express",
      trackingNumber: "GIGL-234567890",
      estimatedDelivery: "March 26, 2026",
      currentLocation: "En route to Lagos",
    },
  },
  {
    id: "ORD-2026-0320-002",
    date: "March 20, 2026",
    status: "delivered",
    total: 320000,
    items: [
      {
        name: "Samsung 55\" 4K Smart TV",
        quantity: 1,
        price: 320000,
        image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=200",
      },
    ],
  },
  {
    id: "ORD-2026-0318-003",
    date: "March 18, 2026",
    status: "pending",
    total: 65000,
    items: [
      {
        name: "Office Desk Chair",
        quantity: 1,
        price: 65000,
        image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=200",
      },
    ],
  },
];

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-[#eab308]", bg: "bg-[#eab308]/10" },
  in_transit: { label: "In Transit", icon: Truck, color: "text-blue-600", bg: "bg-blue-100" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "text-[#22c55e]", bg: "bg-[#22c55e]/10" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
};

export function Orders() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "in_transit" | "delivered">("all");

  const filteredOrders = activeTab === "all"
    ? orders
    : orders.filter(order => order.status === activeTab);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="sticky top-0 bg-white border-b border-border z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl text-foreground mb-4">My Orders</h1>
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[#22c55e] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === "pending"
                  ? "bg-[#22c55e] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab("in_transit")}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === "in_transit"
                  ? "bg-[#22c55e] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setActiveTab("delivered")}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === "delivered"
                  ? "bg-[#22c55e] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Delivered
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No orders found</p>
            <Link to="/products" className="text-[#22c55e]">
              Start Shopping
            </Link>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const status = statusConfig[order.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;

            return (
              <div key={order.id} className="bg-white rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Order {order.id}</span>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${status.bg}`}>
                      <StatusIcon className={`w-4 h-4 ${status.color}`} />
                      <span className={`text-sm ${status.color}`}>{status.label}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{order.date}</p>
                </div>

                <div className="p-4 space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground line-clamp-2">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        <p className="text-sm text-[#22c55e]">₦{item.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {order.tracking && (
                  <div className="px-4 pb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Tracking Number</span>
                        <span className="text-sm text-blue-600">{order.tracking.trackingNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-muted-foreground">{order.tracking.currentLocation}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Estimated delivery: {order.tracking.estimatedDelivery}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 border-t border-border bg-muted">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Total</span>
                    <span className="text-lg text-[#22c55e]">₦{order.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-4 flex gap-2">
                  {order.status === "delivered" && (
                    <button className="flex-1 py-2 bg-[#22c55e] text-white rounded-lg">
                      Leave Review
                    </button>
                  )}
                  {order.status === "in_transit" && (
                    <button className="flex-1 py-2 border border-[#22c55e] text-[#22c55e] rounded-lg">
                      Track Order
                    </button>
                  )}
                  <Link
                    to="/messages"
                    className="flex-1 py-2 border border-border text-foreground rounded-lg text-center"
                  >
                    Contact Seller
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
