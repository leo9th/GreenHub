import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Package, Clock, Truck, CheckCircle } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { formatGreenHubRelative } from "../utils/formatGreenHubTime";

type OrderStatusTab = "all" | "pending" | "processing" | "shipped" | "delivered";

type OrderRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  total_amount?: number | null;
  total_price?: number | null;
  amount?: number | null;
};
function orderGrandTotal(o: OrderRow): number {
  const v = o.total_price || o.total_amount || o.amount || 0;
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}


type OrderItemRow = {
  order_id: string;
  product_id: string | number | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  /** Snapshot column when migration applied */
  price_at_time?: number | null;
  /** Base schema column (see 20260508120000_create_order_items.sql) */
  unit_price?: number | null;
};

/** DB may only have `unit_price`; newer migrations add `price_at_time`. */
function lineUnitPrice(it: OrderItemRow): number {
  const v = it.price_at_time ?? it.unit_price;
  return Number(v) || 0;
}

type OrderEventRow = {
  id: string;
  order_id: string;
  event_label: string;
  created_at: string;
};

function normalizeTabStatus(dbStatus: string | null, tab: OrderStatusTab): boolean {
  if (tab === "all") return true;
  const s = (dbStatus || "").toLowerCase();
  switch (tab) {
    case "pending":
      return (
        s === "pending" ||
        s === "awaiting_payment" ||
        s === "created" ||
        s === "pending_payment" ||
        s === "pod_confirmed"
      );
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
  const [eventsByOrder, setEventsByOrder] = useState<Map<string, OrderEventRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = authUser?.id?.trim();
    if (!userId) {
      setOrders([]);
      setItemsByOrder(new Map());
      setEventsByOrder(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: orderRows, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });
      console.log("DEBUG: Supabase Error", oErr);

      if (oErr) {
        console.error("[Orders] orders select error", oErr);
        throw oErr;
      }

      const list = (orderRows ?? []) as OrderRow[];
      setOrders(list);

      const ids = list.map((o) => String(o.id || "").trim()).filter((v) => v.length > 0);
      if (ids.length === 0) {
        setItemsByOrder(new Map());
        setEventsByOrder(new Map());
        return;
      }

      const { data: itemRows, error: iErr } = await supabase.from("order_items").select("*").in("order_id", ids);
      console.log("DEBUG: Supabase Error", iErr);

      if (iErr) {
        console.error("[Orders] order_items select error", iErr);
        throw iErr;
      }

      const map = new Map<string, OrderItemRow[]>();
      for (const it of (itemRows ?? []) as OrderItemRow[]) {
        const oid = String(it.order_id);
        if (!map.has(oid)) map.set(oid, []);
        map.get(oid)!.push(it);
      }
      setItemsByOrder(map);

      const { data: evRows, error: evErr } = await supabase
        .from("order_events")
        .select("id, order_id, event_label, created_at")
        .in("order_id", ids)
        .order("created_at", { ascending: true });
      console.log("DEBUG: Supabase Error", evErr);

      if (evErr) {
        console.error("[Orders] order_events select error (expect columns: id, order_id, event_label, created_at)", evErr);
        setEventsByOrder(new Map());
        return;
      }

      const evMap = new Map<string, OrderEventRow[]>();
      for (const ev of (evRows ?? []) as OrderEventRow[]) {
        const oid = String(ev.order_id);
        if (!evMap.has(oid)) evMap.set(oid, []);
        evMap.get(oid)!.push(ev);
      }
      setEventsByOrder(evMap);
    } catch (e: unknown) {
      console.error("[Orders] load failed", e);
      setError(e instanceof Error ? e.message : "Could not load orders");
      setOrders([]);
      setItemsByOrder(new Map());
      setEventsByOrder(new Map());
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
    const s = formatGreenHubRelative(iso);
    return s || "—";
  };

  const formatEventWhen = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "";
    }
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
            const events = eventsByOrder.get(String(order.id)) ?? [];
            const displayStatus = (order.status || "—").replace(/_/g, " ");
            const dbTotal = orderGrandTotal(order);
            const total =
              dbTotal > 0
                ? dbTotal
                : items.reduce((sum, it) => {
                    const q = Math.max(0, Number(it.quantity) || 0);
                    const u = lineUnitPrice(it);
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
                        {formatPrice(lineUnitPrice(item))}
                      </p>
                    </div>
                  </div>
                ))}

                {events.length > 0 ? (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status timeline</p>
                    <ol className="m-0 p-0 list-none space-y-2">
                      {events.map((ev) => (
                        <li key={ev.id} className="flex gap-2">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{ev.event_label}</p>
                            <p className="text-xs text-gray-500 tabular-nums">{formatEventWhen(ev.created_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

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
