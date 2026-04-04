import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Package, Clock, Truck, CheckCircle } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

type OrderStatusTab = "all" | "pending" | "processing" | "shipped" | "delivered";

type OrderRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  total_amount: number | null;
};

type OrderItemRow = {
  order_id: string;
  product_id: string | number | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  price_at_time: number | null;
};

function normalizeTabStatus(dbStatus: string | null, tab: OrderStatusTab): boolean {
  if (tab === "all") return true;
  const s = (dbStatus || "").toLowerCase();
  switch (tab) {
    case "pending":
      return s === "pending" || s === "awaiting_payment" || s === "created";
    case "processing":
      return s === "processing" || s === "paid" || s === "confirmed";
    case "shipped":
      return s === "shipped" || s === "in_transit";
    case "delivered":
      return s === "delivered" || s === "completed";
    default:
      return false;
  }
}

export default function Orders() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatusTab>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Map<string, OrderItemRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authUser?.id) {
      setOrders([]);
      setItemsByOrder(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: orderRows, error: oErr } = await supabase
        .from("orders")
        .select("id, created_at, status, total_amount")
        .eq("buyer_id", authUser.id)
        .order("created_at", { ascending: false });

      if (oErr) throw oErr;

      const list = (orderRows ?? []) as OrderRow[];
      setOrders(list);

      const ids = list.map((o) => o.id).filter(Boolean);
      if (ids.length === 0) {
        setItemsByOrder(new Map());
        return;
      }

      const { data: itemRows, error: iErr } = await supabase
        .from("order_items")
        .select("order_id, product_id, product_title, product_image, quantity, price_at_time")
        .in("order_id", ids);

      if (iErr) throw iErr;

      const map = new Map<string, OrderItemRow[]>();
      for (const it of (itemRows ?? []) as OrderItemRow[]) {
        const oid = String(it.order_id);
        if (!map.has(oid)) map.set(oid, []);
        map.get(oid)!.push(it);
      }
      setItemsByOrder(map);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load orders");
      setOrders([]);
      setItemsByOrder(new Map());
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const tabs = [
    { id: "all" as OrderStatusTab, label: "All", icon: Package },
    { id: "pending" as OrderStatusTab, label: "Pending", icon: Clock },
    { id: "processing" as OrderStatusTab, label: "Processing", icon: Package },
    { id: "shipped" as OrderStatusTab, label: "Shipped", icon: Truck },
    { id: "delivered" as OrderStatusTab, label: "Delivered", icon: CheckCircle },
  ];

  const filteredOrders = useMemo(
    () => orders.filter((o) => normalizeTabStatus(o.status, activeTab)),
    [orders, activeTab],
  );

  const getStatusColor = (status: string | null) => {
    const s = (status || "").toLowerCase();
    if (s === "pending" || s === "awaiting_payment") return "bg-yellow-100 text-yellow-800";
    if (s === "processing" || s === "paid" || s === "confirmed") return "bg-blue-100 text-blue-800";
    if (s === "shipped" || s === "in_transit") return "bg-purple-100 text-purple-800";
    if (s === "delivered" || s === "completed") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string | null) => {
    const s = (status || "").toLowerCase();
    if (s === "pending" || s === "awaiting_payment") return <Clock className="w-4 h-4" />;
    if (s === "processing" || s === "paid" || s === "confirmed") return <Package className="w-4 h-4" />;
    if (s === "shipped" || s === "in_transit") return <Truck className="w-4 h-4" />;
    if (s === "delivered" || s === "completed") return <CheckCircle className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const formatOrderLabel = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">My Orders</h1>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="px-4 flex gap-6 max-w-7xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? "border-[#22c55e] text-[#22c55e]" : "border-transparent text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-3">
        {error ? <div className="text-sm text-red-600 py-4">{error}</div> : null}
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-600">Loading orders…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No orders found</h3>
            <p className="text-gray-600 text-sm mb-6">
              {activeTab === "all" ? "You haven't placed any orders yet" : `You don't have any ${activeTab} orders`}
            </p>
            <Link to="/products" className="inline-block px-6 py-3 bg-[#22c55e] text-white rounded-lg font-medium">
              Start Shopping
            </Link>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const items = itemsByOrder.get(String(order.id)) ?? [];
            const displayStatus = (order.status || "—").replace(/_/g, " ");
            const total =
              order.total_amount != null && Number.isFinite(Number(order.total_amount))
                ? Number(order.total_amount)
                : items.reduce((sum, it) => {
                    const q = Math.max(0, Number(it.quantity) || 0);
                    const u = Number(it.price_at_time) || 0;
                    return sum + q * u;
                  }, 0);

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800 font-mono text-sm">{order.id.slice(0, 8)}…</p>
                    <p className="text-sm text-gray-600">{formatOrderLabel(order.created_at)}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 capitalize ${getStatusColor(order.status)}`}
                  >
                    {getStatusIcon(order.status)}
                    {displayStatus}
                  </span>
                </div>

                {items.map((item, index) => (
                  <div key={`${item.product_id}-${index}`} className="flex gap-3 mb-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                        {item.product_title || "Product"}
                      </h3>
                      <p className="text-sm text-gray-600">Qty: {item.quantity ?? 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatPrice(Number(item.price_at_time) || 0)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-lg font-bold text-[#22c55e]">{formatPrice(total)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
