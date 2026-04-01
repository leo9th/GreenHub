import { Link, useParams, useNavigate } from "react-router";
import { ArrowLeft, Package, MapPin, Phone, MessageCircle, CheckCircle, Star } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { getAvatarUrl } from "../../utils/getAvatar";

export default function OrderDetail() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();

  const order = {
    id: "ORD-2024-001",
    date: "2024-03-20",
    status: "delivered",
    deliveryDate: "2024-03-23",
    items: [
      {
        id: 1,
        image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200",
        title: "iPhone 13 Pro Max 256GB - Pacific Blue",
        quantity: 1,
        price: 450000,
        seller: {
          id: 1,
          name: "Chidi Okonkwo",
          avatar: getAvatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", "male", "Chidi Okonkwo"),
          phone: "08012345678",
        },
      },
      {
        id: 2,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
        title: "Nike Air Max 270 Shoes",
        quantity: 2,
        price: 25000,
        seller: {
          id: 2,
          name: "Amina Yusuf",
          avatar: getAvatarUrl("https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", "female", "Amina Yusuf"),
          phone: "08098765432",
        },
      },
    ],
    deliveryAddress: {
      fullName: "John Doe",
      phone: "08011111111",
      address: "15 Admiralty Way, Lekki Phase 1",
      state: "Lagos",
      lga: "Eti-Osa",
    },
    payment: {
      method: "Card Payment",
      status: "Paid",
      subtotal: 500000,
      delivery: 5500,
      platformFee: 50000,
      total: 555500,
    },
    tracking: [
      { date: "2024-03-20 10:30 AM", status: "Order placed", description: "Your order has been received", completed: true },
      { date: "2024-03-20 02:15 PM", status: "Payment confirmed", description: "Payment received successfully", completed: true },
      { date: "2024-03-21 09:00 AM", status: "Processing", description: "Seller is preparing your items", completed: true },
      { date: "2024-03-22 11:45 AM", status: "Shipped", description: "Your order is on the way", completed: true },
      { date: "2024-03-23 03:20 PM", status: "Delivered", description: "Order delivered successfully", completed: true },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-800">Order Details</h1>
            <p className="text-sm text-gray-600">{order.id}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Status Banner */}
        <div className="bg-[#22c55e] text-white rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6" />
            <div>
              <h2 className="font-semibold">Order Delivered</h2>
              <p className="text-sm text-white/90">On {order.deliveryDate}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Items Ordered</h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id}>
                <Link to={`/products/${item.id}`} className="flex gap-3 mb-3">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">Qty: {item.quantity}</p>
                    <p className="text-base font-semibold text-gray-900">{(item.price)}</p>
                  </div>
                </Link>

                {/* Seller Info */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <img src={item.seller.avatar} alt={item.seller.name} className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.seller.name}</p>
                    <p className="text-xs text-gray-600">Seller</p>
                  </div>
                  <Link to={`/messages/${item.seller.id}`} className="p-2 bg-[#22c55e] rounded-lg">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </Link>
                  <a href={`tel:${item.seller.phone}`} className="p-2 border border-gray-300 rounded-lg">
                    <Phone className="w-4 h-4 text-gray-600" />
                  </a>
                </div>

                {/* Review Button */}
                {order.status === "delivered" && (
                  <Link
                    to={`/orders/${order.id}/review?productId=${item.id}`}
                    className="mt-3 w-full py-2 border border-[#22c55e] text-[#22c55e] rounded-lg font-medium text-sm text-center flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Write Review
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Delivery Address</h2>
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-800 mb-1">{order.deliveryAddress.fullName}</p>
              <p>{order.deliveryAddress.phone}</p>
              <p className="mt-2">{order.deliveryAddress.address}</p>
              <p>{order.deliveryAddress.lga}, {order.deliveryAddress.state}</p>
            </div>
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Order Tracking</h2>
          <div className="space-y-4">
            {order.tracking.map((track, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${track.completed ? "bg-[#22c55e]" : "bg-gray-200"}`}>
                    {track.completed ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>
                  {index < order.tracking.length - 1 && (
                    <div className={`w-0.5 h-12 ${track.completed ? "bg-[#22c55e]" : "bg-gray-200"}`} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className={`font-medium ${track.completed ? "text-gray-800" : "text-gray-500"}`}>
                    {track.status}
                  </p>
                  <p className="text-sm text-gray-600">{track.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{track.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Payment Summary</h2>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium text-gray-800">{order.payment.method}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Status</span>
              <span className="font-medium text-[#22c55e]">{order.payment.status}</span>
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-800">{(order.payment.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="font-medium text-gray-800">{(order.payment.delivery)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Platform Fee (10%)</span>
              <span className="font-medium text-gray-800">{(order.payment.platformFee)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-800">Total Paid</span>
              <span className="text-xl font-bold text-[#22c55e]">{(order.payment.total)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {order.status === "delivered" && (
          <div className="flex gap-3">
            <Link
              to={`/orders/${order.id}`}
              className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-semibold text-center"
            >
              Reorder Items
            </Link>
            <Link
              to="/support"
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold text-center"
            >
              Get Help
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
