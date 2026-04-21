import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Loader2,
  MessageCircle,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";

type OrderRevenueRow = {
  total_amount?: number | null;
  total_price?: number | null;
  amount?: number | null;
};

type PayoutRow = {
  id: string;
  seller_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

type SellerProfileLite = {
  id: string;
  full_name: string | null;
};

type LowStockProductRow = {
  id: string | number;
  title: string | null;
  seller_id: string | null;
  stock_quantity: number | null;
  status: string | null;
};

function asMoney(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminDashboard() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedPayoutTotal, setCompletedPayoutTotal] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProductRow[]>([]);
  const [sellerNames, setSellerNames] = useState<Map<string, string>>(new Map());
  const [confirmingPayoutId, setConfirmingPayoutId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!authUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();

      const roleFromProfile =
        profileRow && typeof (profileRow as { role?: unknown }).role === "string"
          ? String((profileRow as { role?: unknown }).role).toLowerCase()
          : "";
      const roleFromMeta =
        typeof authUser.user_metadata?.role === "string"
          ? String(authUser.user_metadata.role).toLowerCase()
          : "";
      const allowed = roleFromProfile === "admin" || roleFromMeta === "admin";
      setIsAdmin(allowed);

      if (!allowed) {
        setTotalRevenue(0);
        setCompletedPayoutTotal(0);
        setPendingPayouts([]);
        setLowStockProducts([]);
        setSellerNames(new Map());
        return;
      }

      const [{ data: deliveredOrders, error: deliveredErr }, { data: payoutRows, error: payoutErr }, { data: stockRows, error: stockErr }] =
        await Promise.all([
          supabase
            .from("orders")
            .select("total_amount, total_price, amount")
            .in("status", ["delivered", "completed"]),
          supabase
            .from("payout_requests")
            .select("id, seller_id, amount, status, created_at")
            .in("status", ["pending", "completed"])
            .order("created_at", { ascending: false }),
          supabase
            .from("products")
            .select("id, title, seller_id, stock_quantity, status")
            .lt("stock_quantity", 5)
            .eq("status", "active")
            .order("stock_quantity", { ascending: true })
            .limit(30),
        ]);

      if (deliveredErr) throw deliveredErr;
      if (payoutErr) throw payoutErr;
      if (stockErr) throw stockErr;

      const delivered = (deliveredOrders ?? []) as OrderRevenueRow[];
      const grossDelivered = delivered.reduce((sum, row) => {
        const raw = row.total_amount ?? row.total_price ?? row.amount ?? 0;
        return sum + asMoney(raw);
      }, 0);
      setTotalRevenue(grossDelivered * 0.1);

      const payouts = (payoutRows ?? []) as PayoutRow[];
      const completedTotal = payouts
        .filter((p) => String(p.status ?? "").toLowerCase() === "completed")
        .reduce((sum, p) => sum + asMoney(p.amount), 0);
      setCompletedPayoutTotal(completedTotal);

      const pending = payouts.filter((p) => String(p.status ?? "").toLowerCase() === "pending");
      setPendingPayouts(pending);
      setLowStockProducts((stockRows ?? []) as LowStockProductRow[]);

      const sellerIds = [
        ...new Set(
          [
            ...pending.map((p) => (p.seller_id ? String(p.seller_id) : "")),
            ...(stockRows ?? []).map((p) => {
              const s = (p as { seller_id?: unknown }).seller_id;
              return s ? String(s) : "";
            }),
          ].filter(Boolean),
        ),
      ];
      if (sellerIds.length > 0) {
        const { data: nameRows } = await supabase.from("profiles_public").select("id, full_name").in("id", sellerIds);
        const names = new Map<string, string>();
        for (const row of (nameRows ?? []) as SellerProfileLite[]) {
          names.set(row.id, (row.full_name || "").trim() || "Seller");
        }
        setSellerNames(names);
      } else {
        setSellerNames(new Map());
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, authUser?.user_metadata?.role]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void loadDashboard();
  }, [authLoading, authUser, loadDashboard, navigate]);

  const confirmPayment = useCallback(
    async (row: PayoutRow) => {
      if (!row.id || confirmingPayoutId) return;
      setConfirmingPayoutId(row.id);
      try {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("payout_requests")
          .update({
            status: "completed",
            completed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", row.id)
          .eq("status", "pending");

        if (error) throw error;
        toast.success("Payout marked as completed.");
        await loadDashboard();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not confirm payment");
      } finally {
        setConfirmingPayoutId(null);
      }
    },
    [confirmingPayoutId, loadDashboard],
  );

  const pendingTotal = useMemo(
    () => pendingPayouts.reduce((sum, p) => sum + asMoney(p.amount), 0),
    [pendingPayouts],
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#07110d] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#07110d] text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-2xl border border-emerald-900/60 bg-[#0b1b14] p-6">
          <h1 className="text-xl font-semibold text-emerald-300">Admin access required</h1>
          <p className="mt-2 text-sm text-emerald-100/80">
            This dashboard is restricted to accounts with role set to <code>admin</code>.
          </p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110d] text-white pb-8">
      <header className="sticky top-0 z-40 border-b border-emerald-900/50 bg-[#07110d]/95 backdrop-blur">
        <div className="px-4 py-4 max-w-6xl mx-auto">
          <h1 className="text-xl font-bold text-emerald-300">GreenHub Admin Dashboard</h1>
          <p className="text-sm text-emerald-100/70">Finance, payouts, and inventory oversight</p>
        </div>
      </header>

      <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Total Revenue (10% delivered)</p>
              <DollarSign className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPrice(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Completed Seller Payouts</p>
              <Wallet className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPrice(completedPayoutTotal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Pending Payout Queue</p>
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPrice(pendingTotal)}</p>
            <p className="mt-1 text-xs text-emerald-100/70">{pendingPayouts.length} pending request(s)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/admin/boosts"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-emerald-800/60 bg-[#0b1b14] hover:border-emerald-500 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center mb-2">
              <TrendingUp className="w-6 h-6 text-emerald-300" />
            </div>
            <span className="text-sm font-medium text-emerald-100 text-center">Boost payments</span>
          </Link>
          <Link
            to="/admin/chatbot-learning"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-emerald-800/60 bg-[#0b1b14] hover:border-emerald-500 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center mb-2">
              <MessageCircle className="w-6 h-6 text-emerald-300" />
            </div>
            <span className="text-sm font-medium text-emerald-100 text-center">Chatbot learning</span>
          </Link>
          <Link
            to="/admin/job-applications"
            className="rounded-lg border border-emerald-800/60 bg-[#0b1b14] p-4 text-center hover:border-emerald-500 transition-colors"
          >
            <Briefcase className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="font-medium text-emerald-100">Job applications</p>
          </Link>
          <Link
            to="/admin/users"
            className="rounded-lg border border-emerald-800/60 bg-[#0b1b14] p-4 text-center hover:border-emerald-500 transition-colors"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="font-medium text-emerald-100">Manage Users</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-emerald-200">Pending Payouts</h2>
              <span className="text-xs text-emerald-100/70">{pendingPayouts.length} awaiting confirmation</span>
            </div>
            {pendingPayouts.length === 0 ? (
              <p className="text-sm text-emerald-100/70">No pending payout requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingPayouts.map((row) => (
                  <div key={row.id} className="rounded-lg border border-emerald-900/70 bg-[#10241b] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-100 truncate">
                          {row.seller_id ? sellerNames.get(row.seller_id) || "Seller" : "Seller"}
                        </p>
                        <p className="text-xs text-emerald-100/60 font-mono truncate">{row.seller_id || "unknown-seller"}</p>
                      </div>
                      <p className="text-lg font-bold text-emerald-300">{formatPrice(row.amount ?? 0)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-emerald-100/60">
                        Requested {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                      </p>
                      <button
                        type="button"
                        disabled={confirmingPayoutId === row.id}
                        onClick={() => void confirmPayment(row)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {confirmingPayoutId === row.id ? "Confirming..." : "Confirm Payment"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-emerald-200">Low Stock Inventory</h2>
              <span className="text-xs text-emerald-100/70">stock_quantity &lt; 5</span>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-emerald-100/70">No low-stock products found.</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div key={String(product.id)} className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-100 truncate">{product.title || "Untitled product"}</p>
                        <p className="text-xs text-amber-200/80">
                          Seller:{" "}
                          {product.seller_id
                            ? sellerNames.get(product.seller_id) || product.seller_id
                            : "Unknown"}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-100">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {Math.max(0, asMoney(product.stock_quantity))} left
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
          <h2 className="font-semibold text-emerald-200">Admin Navigation</h2>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              to="/admin/products"
              className="rounded-lg border border-emerald-900/70 bg-[#10241b] p-3 text-sm font-medium text-emerald-100 hover:border-emerald-500"
            >
              <Package className="mb-2 h-4 w-4 text-emerald-300" />
              Manage products
            </Link>
            <Link
              to="/admin/users"
              className="rounded-lg border border-emerald-900/70 bg-[#10241b] p-3 text-sm font-medium text-emerald-100 hover:border-emerald-500"
            >
              <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-300" />
              Manage users
            </Link>
            <Link
              to="/admin/job-applications"
              className="rounded-lg border border-emerald-900/70 bg-[#10241b] p-3 text-sm font-medium text-emerald-100 hover:border-emerald-500"
            >
              <Briefcase className="mb-2 h-4 w-4 text-emerald-300" />
              Job applications
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
import { Link } from "react-router";
import { Users, Package, ShoppingBag, DollarSign, TrendingUp, AlertCircle, Briefcase, MessageCircle } from "lucide-react";
import { useCurrency } from "../../hooks/useCurrency";

export default function AdminDashboard() {
  const formatPrice = useCurrency();
  const stats = [
    { label: "Total Users", value: "12,458", change: "+12%", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Products", value: "3,245", change: "+8%", icon: Package, color: "text-[#22c55e]", bg: "bg-[#22c55e]/10" },
    { label: "Total Orders", value: "8,932", change: "+24%", icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Revenue", value: (45680000), change: "+18%", icon: DollarSign, color: "text-[#eab308]", bg: "bg-[#eab308]/10" },
  ];

  const recentUsers = [
    { id: 1, name: "Amina Yusuf", email: "amina@example.com", joined: "2 hours ago", verified: true },
    { id: 2, name: "Tunde Adebayo", email: "tunde@example.com", joined: "5 hours ago", verified: false },
    { id: 3, name: "Ngozi Okafor", email: "ngozi@example.com", joined: "1 day ago", verified: true },
  ];

  const recentOrders = [
    { id: "ORD-2024-1001", user: "Emeka Nwosu", amount: 450000, status: "pending", date: "10 mins ago" },
    { id: "ORD-2024-1000", user: "Fatima Mohammed", amount: 85000, status: "processing", date: "1 hour ago" },
    { id: "ORD-2024-999", user: "Chidi Okonkwo", amount: 220000, status: "shipped", date: "3 hours ago" },
  ];

  const reportedProducts = [
    { id: 1, title: "iPhone 13 Pro Max 256GB", seller: "John Doe", reports: 3, reason: "Fake product" },
    { id: 2, title: "Nike Air Max Shoes", seller: "Jane Smith", reports: 2, reason: "Misleading description" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-4 max-w-6xl mx-auto">
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Manage and monitor GreenHub platform</p>
        </div>
      </header>

      <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-sm font-medium text-[#22c55e] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/admin/boosts"
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-gray-200 hover:border-[#22c55e] hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-6 h-6 text-[#22c55e]" />
            </div>
            <span className="text-sm font-medium text-gray-800 text-center">Boost payments</span>
          </Link>
          <Link
            to="/admin/chatbot-learning"
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-gray-200 hover:border-[#22c55e] hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
              <MessageCircle className="w-6 h-6 text-[#15803d]" />
            </div>
            <span className="text-sm font-medium text-gray-800 text-center">Chatbot learning</span>
          </Link>
          <Link
            to="/admin/job-applications"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <Briefcase className="w-8 h-8 text-teal-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">Job applications</p>
          </Link>
          <Link
            to="/admin/users"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">Manage Users</p>
          </Link>
          <Link
            to="/admin/products"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <Package className="w-8 h-8 text-[#22c55e] mx-auto mb-2" />
            <p className="font-medium text-gray-800">Manage Products</p>
          </Link>
          <Link
            to="/admin/orders"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <ShoppingBag className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">View Orders</p>
          </Link>
          <Link
            to="/admin/reports"
            className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="font-medium text-gray-800">Reports</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recent Users</h2>
              <Link to="/admin/users" className="text-sm text-[#22c55e] font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{user.name}</p>
                      {user.verified && (
                        <span className="text-[#22c55e] text-xs">✓</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.joined}</p>
                  </div>
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="text-sm text-[#22c55e] font-medium"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recent Orders</h2>
              <Link to="/admin/orders" className="text-sm text-[#22c55e] font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{order.id}</p>
                      <p className="text-sm text-gray-600">{order.user}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{(order.amount)}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reported Products */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Reported Products
            </h2>
            <Link to="/admin/products?filter=reported" className="text-sm text-[#22c55e] font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {reportedProducts.map((product) => (
              <div key={product.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{product.title}</p>
                    <p className="text-sm text-gray-600">by {product.seller}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-medium">
                    {product.reports} reports
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">Reason: {product.reason}</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium">
                    Remove Product
                  </button>
                  <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm font-medium">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
