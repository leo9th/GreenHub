import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Package, Loader2, ShoppingBag, Eye, BarChart3, Truck } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { getAvatarUrl } from "../../utils/getAvatar";

/** Order is "realized" for seller revenue once payment succeeded or fulfillment completed. Adjust to match your workflow. */
const REVENUE_ORDER_STATUSES = new Set(["paid", "delivered", "completed"]);

type OrderRow = { id: string; status: string | null; created_at: string | null; buyer_id: string | null };

type OrderItemRow = {
  order_id: string;
  product_title: string | null;
  price_at_time: number | null;
  quantity: number | null;
};

type RecentRow = {
  orderId: string;
  productTitle: string;
  lineTotal: number;
  orderStatus: string;
  createdAt: string | null;
  buyerLabel: string;
};

export default function SellerDashboard() {
  const formatPrice = useCurrency();
  const { profile, user: authUser, loading: authLoading } = useAuth();

  const userName = profile?.full_name || authUser?.user_metadata?.full_name || "GreenHub Seller";
  const userPhone = profile?.phone || authUser?.user_metadata?.phone || "ADD PHONE NUMBER";
  const avatarUrl = getAvatarUrl(profile?.avatar_url, profile?.gender, userName);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [markingOrderId, setMarkingOrderId] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!authUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: productRows, error: productsError } = await supabase
        .from("products")
        .select("views")
        .eq("seller_id", authUser.id);

      if (productsError) throw productsError;

      const rows = productRows ?? [];
      setTotalProducts(rows.length);
      setTotalViews(rows.reduce((sum, r) => sum + (typeof r.views === "number" ? r.views : Number(r.views) || 0), 0));

      const { data: itemRows, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, product_title, price_at_time, quantity")
        .eq("seller_id", authUser.id);

      if (itemsError) throw itemsError;

      const items = (itemRows ?? []) as OrderItemRow[];
      const orderIds = [...new Set(items.map((i) => String(i.order_id)).filter(Boolean))];

      let orders: OrderRow[] = [];
      if (orderIds.length > 0) {
        const { data: orderData, error: ordersError } = await supabase
          .from("orders")
          .select("id, status, created_at, buyer_id")
          .in("id", orderIds);

        if (ordersError) throw ordersError;
        orders = (orderData ?? []) as OrderRow[];
      }

      const orderMap = new Map<string, OrderRow>();
      for (const o of orders) {
        orderMap.set(String(o.id), o);
      }

      setTotalOrders(orderIds.length);

      let revenue = 0;
      for (const it of items) {
        const o = orderMap.get(String(it.order_id));
        if (!o?.status) continue;
        if (!REVENUE_ORDER_STATUSES.has(String(o.status).toLowerCase())) continue;
        const qty = Math.max(0, Number(it.quantity) || 0);
        const unit = Number(it.price_at_time) || 0;
        revenue += unit * qty;
      }
      setTotalRevenue(revenue);

      const buyerIds = [...new Set(orders.map((o) => o.buyer_id).filter(Boolean))] as string[];
      const buyerNames = new Map<string, string>();
      if (buyerIds.length > 0) {
        const { data: profs } = await supabase.from("profiles_public").select("id, full_name").in("id", buyerIds);
        for (const p of profs ?? []) {
          if (p.id && p.full_name) buyerNames.set(p.id, p.full_name as string);
        }
      }

      const byOrder = new Map<string, { order: OrderRow; items: OrderItemRow[] }>();
      for (const it of items) {
        const oid = String(it.order_id);
        const o = orderMap.get(oid);
        if (!o) continue;
        if (!byOrder.has(oid)) byOrder.set(oid, { order: o, items: [] });
        byOrder.get(oid)!.items.push(it);
      }

      const recentSorted = [...byOrder.entries()]
        .map(([orderId, { order, items: its }]) => {
          const lineTotal = its.reduce((sum, it) => {
            const qty = Math.max(0, Number(it.quantity) || 0);
            const unit = Number(it.price_at_time) || 0;
            return sum + unit * qty;
          }, 0);
          const first = its[0];
          const productTitle =
            its.length === 1
              ? first?.product_title?.trim() || "Product"
              : `${its.length} items from your listings`;
          const bid = order.buyer_id;
          const buyerLabel = bid ? buyerNames.get(bid) || "Buyer" : "Buyer";
          return {
            orderId,
            productTitle,
            lineTotal,
            orderStatus: String(order.status || "—"),
            createdAt: order.created_at,
            buyerLabel,
          } satisfies RecentRow;
        })
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 8);

      setRecent(recentSorted);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load dashboard");
      setTotalProducts(0);
      setTotalViews(0);
      setTotalOrders(0);
      setTotalRevenue(0);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  const markSellerItemsShipped = useCallback(
    async (orderId: string) => {
      if (!authUser?.id) return;
      setMarkingOrderId(orderId);
      try {
        const { data: rows, error } = await supabase
          .from("order_items")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("seller_id", authUser.id);

        if (error) throw error;

        const toShip = (rows ?? []).filter((r) => {
          const s = String(r.status || "").toLowerCase();
          return s === "pending" || s === "processing";
        });

        if (toShip.length === 0) {
          toast.message("Nothing to ship", {
            description: "Your items in this order are already shipped or completed.",
          });
          return;
        }

        for (const row of toShip) {
          const { error: uErr } = await supabase.from("order_items").update({ status: "shipped" }).eq("id", row.id);
          if (uErr) throw uErr;
        }

        const { error: evErr } = await supabase.from("order_events").insert({
          order_id: orderId,
          event_label: "Marked as shipped",
          metadata: { seller_id: authUser.id, order_item_ids: toShip.map((r) => r.id) },
        });
        if (evErr) throw evErr;

        toast.success("Marked as shipped");
        void loadMetrics();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not update shipment status");
      } finally {
        setMarkingOrderId(null);
      }
    },
    [authUser?.id, loadMetrics],
  );

  useEffect(() => {
    if (authLoading) return;
    void loadMetrics();
  }, [authLoading, loadMetrics]);

  const formatOrderWhen = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <div className="min-h-screen bg-[#f2f4f8] pb-10">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8">
        <div className="w-full md:w-[280px] flex-shrink-0">
          <div className="bg-transparent">
            <div className="flex flex-col items-center justify-center p-6 mb-2">
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden mb-4 ring-2 ring-[#b2dfdb]">
                <img src={avatarUrl} alt="" className="w-full h-full object-cover bg-[#b2dfdb]" />
              </div>
              <h2 className="text-xl font-medium text-gray-800 text-center">{userName}</h2>
              <Link
                to="/settings/profile/edit"
                className="text-[11px] font-bold text-gray-400 mt-2 tracking-wider uppercase hover:text-[#22c55e] transition-colors"
              >
                {userPhone}
              </Link>
            </div>

            <div className="space-y-1">
              <Link
                to="/seller/products/new"
                className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg"
              >
                <span className="text-xl w-6 text-center">➕</span>
                <span className="text-[15px] font-medium text-gray-600">Add New Product</span>
              </Link>
              <Link to="/seller/products" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">📋</span>
                <span className="text-[15px] font-medium text-gray-600">My adverts</span>
              </Link>
              <Link to="/seller/boosts" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">📈</span>
                <span className="text-[15px] font-medium text-gray-600">My boosts</span>
              </Link>
              <Link
                to="/seller/boosts"
                className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg"
              >
                <span className="text-xl w-6 text-center">📈</span>
                <span className="text-[15px] font-medium text-gray-600">My boosts</span>
              </Link>
              <Link
                to="/seller/verification"
                className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg"
              >
                <span className="text-xl w-6 text-center">✓</span>
                <span className="text-[15px] font-medium text-gray-600">Verification</span>
              </Link>
              <Link to="/profile" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">👤</span>
                <span className="text-[15px] font-medium text-gray-600">Profile</span>
              </Link>
              <Link to="/messages" className="flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-200/50 rounded-lg">
                <span className="text-xl w-6 text-center">💬</span>
                <span className="text-[15px] font-medium text-gray-600">Messages</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent min-h-[480px]">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-medium text-gray-800">Dashboard Insights</h1>
              <Link
                to="/seller/products/new"
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <span className="text-lg leading-none">+</span> Add Product
              </Link>
            </div>

            <div className="p-6">
              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                  <p className="mt-2 text-xs text-red-700">
                    Run the SQL in{" "}
                    <code className="rounded bg-red-100 px-1">supabase/migrations/20260404120000_seller_dashboard_and_verification.sql</code>{" "}
                    if columns or policies are missing.
                  </p>
                </div>
              ) : null}

              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-[#22c55e]" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total products</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Eye className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total views</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Package className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total orders</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                      <p className="text-[10px] text-gray-400 mt-1">Orders that include your items</p>
                    </div>
                    <div className="rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/5 p-4">
                      <div className="flex items-center gap-2 text-[#15803d] mb-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total revenue</span>
                      </div>
                      <p className="text-2xl font-bold text-[#15803d]">{formatPrice(totalRevenue)}</p>
                      <p className="text-[10px] text-[#166534]/80 mt-1">Paid / delivered / completed line items</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-800">Recent activity</h2>
                      <span className="text-xs text-gray-400">{recent.length} shown</span>
                    </div>

                    {recent.length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">No orders with your listings yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {recent.map((row) => (
                          <div
                            key={row.orderId}
                            className="flex flex-col gap-3 sm:flex-row sm:items-stretch p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/80 transition-colors"
                          >
                            <Link to={`/orders/${row.orderId}`} className="flex gap-4 flex-1 min-w-0">
                              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                <Package className="w-7 h-7 text-gray-300" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 mb-0.5">
                                  {row.buyerLabel} · {formatOrderWhen(row.createdAt)}
                                </p>
                                <h3 className="font-semibold text-[15px] text-gray-900 line-clamp-2">{row.productTitle}</h3>
                                <p className="text-[#22c55e] font-bold text-base mt-1">{formatPrice(row.lineTotal)}</p>
                                <span className="inline-block mt-2 text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                                  {row.orderStatus}
                                </span>
                              </div>
                            </Link>
                            <div className="flex sm:flex-col sm:justify-center shrink-0">
                              <button
                                type="button"
                                disabled={markingOrderId === row.orderId}
                                onClick={() => void markSellerItemsShipped(row.orderId)}
                                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg border border-[#22c55e] text-[#15803d] text-sm font-semibold hover:bg-[#22c55e]/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                              >
                                {markingOrderId === row.orderId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Truck className="h-4 w-4" aria-hidden />
                                )}
                                Mark as shipped
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
