import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Package, Loader2, ShoppingBag, Eye, BarChart3, Vault, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { getAvatarUrl } from "../../utils/getAvatar";
import SellerOrderManagement from "./SellerOrderManagement";

const REVENUE_ORDER_STATUSES = new Set(["paid", "delivered", "completed"]);
const PAYOUT_MINIMUM = 2000;

type OrderRow = { id: string; status: string | null };

type OrderItemRow = {
  order_id: string;
  product_title: string | null;
  price_at_time?: number | null;
  unit_price?: number | null;
  quantity: number | null;
  status?: string | null;
  net_earnings?: number | null;
};

type OpportunityRow = {
  itemName: string;
  requestCount: number;
};

function lineUnitPrice(it: OrderItemRow): number {
  return Number(it.price_at_time ?? it.unit_price) || 0;
}

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
  const [clearedBalance, setClearedBalance] = useState(0);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);

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

      const { data: itemRows, error: itemsError } = await supabase.from("order_items").select("*").eq("seller_id", authUser.id);

      if (itemsError) {
        console.error("[SellerDashboard] order_items select error", itemsError);
        throw itemsError;
      }

      const items = (itemRows ?? []) as OrderItemRow[];
      const orderIds = [...new Set(items.map((i) => String(i.order_id)).filter(Boolean))];

      let orders: OrderRow[] = [];
      if (orderIds.length > 0) {
        const { data: orderData, error: ordersError } = await supabase
          .from("orders")
          .select("id, status")
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
      let cleared = 0;
      for (const it of items) {
        const o = orderMap.get(String(it.order_id));
        if (!o?.status) continue;
        if (!REVENUE_ORDER_STATUSES.has(String(o.status).toLowerCase())) continue;
        const qty = Math.max(0, Number(it.quantity) || 0);
        const unit = lineUnitPrice(it);
        revenue += unit * qty;

        const lineStatus = String(it.status ?? "").toLowerCase();
        if (lineStatus === "delivered") {
          const netFromRow = Number(it.net_earnings);
          const net = Number.isFinite(netFromRow) ? netFromRow : unit * qty * 0.9;
          cleared += Math.max(0, net);
        }
      }
      setTotalRevenue(revenue);
      setClearedBalance(cleared);

      const { data: requestedRows, error: reqErr } = await supabase
        .from("requested_items")
        .select("item_name")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!reqErr) {
        const counter = new Map<string, number>();
        for (const row of requestedRows ?? []) {
          const key = String((row as { item_name?: string | null }).item_name ?? "")
            .trim()
            .toLowerCase();
          if (!key) continue;
          counter.set(key, (counter.get(key) ?? 0) + 1);
        }

        const top = [...counter.entries()]
          .map(([key, count]) => ({
            itemName: key
              .split(" ")
              .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
              .join(" "),
            requestCount: count,
          }))
          .sort((a, b) => b.requestCount - a.requestCount)
          .slice(0, 5);
        setOpportunities(top);
      } else {
        setOpportunities([]);
      }

    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load dashboard");
      setTotalProducts(0);
      setTotalViews(0);
      setTotalOrders(0);
      setTotalRevenue(0);
      setClearedBalance(0);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  const requestPayout = useCallback(async () => {
    if (!authUser?.id) return;
    if (clearedBalance < PAYOUT_MINIMUM) {
      toast.error(`Minimum payout is ${formatPrice(PAYOUT_MINIMUM)}.`);
      return;
    }
    setRequestingPayout(true);
    try {
      const { error } = await supabase.from("payout_requests").insert({
        seller_id: authUser.id,
        amount: clearedBalance,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Payout request submitted.", {
        icon: <CircleDollarSign className="h-4 w-4 text-emerald-600" />,
        className: "bg-emerald-50 text-emerald-950 border border-emerald-200",
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not request payout");
    } finally {
      setRequestingPayout(false);
    }
  }, [authUser?.id, clearedBalance, formatPrice]);

  useEffect(() => {
    if (authLoading) return;
    void loadMetrics();
  }, [authLoading, loadMetrics]);

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
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
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
                    <div className="col-span-2 lg:col-span-1 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                      <div className="mb-2 flex items-center gap-2 text-emerald-700">
                        <Vault className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Wallet Summary</span>
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cleared Balance</p>
                      <p className="mt-1 text-3xl font-bold text-emerald-700">{formatPrice(clearedBalance)}</p>
                      <button
                        type="button"
                        disabled={requestingPayout}
                        onClick={() => void requestPayout()}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {requestingPayout ? "Requesting..." : "Request Payout"}
                      </button>
                      <p className="mt-1 text-[10px] text-gray-500">Minimum withdrawal: {formatPrice(PAYOUT_MINIMUM)}</p>
                    </div>
                  </div>
                  <section className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-amber-900">Opportunities</h2>
                      <span className="text-xs text-amber-700">{opportunities.length} top requests</span>
                    </div>
                    {opportunities.length === 0 ? (
                      <p className="text-sm text-amber-800/80">No request trends yet. New demand will appear here.</p>
                    ) : (
                      <div className="space-y-2">
                        {opportunities.map((o) => (
                          <div
                            key={o.itemName}
                            className="flex flex-col gap-3 rounded-lg border border-amber-200/60 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="text-sm text-gray-800">
                              <span className="font-semibold text-amber-900">{o.requestCount}</span>{" "}
                              {o.requestCount === 1 ? "user is" : "users are"} looking for{" "}
                              <span className="font-semibold">"{o.itemName}"</span>. Be the first to list it!
                            </p>
                            <Link
                              to={`/seller/products/new?item=${encodeURIComponent(o.itemName)}`}
                              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                            >
                              List Now
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <SellerOrderManagement />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
