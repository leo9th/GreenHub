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
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Platform revenue (10% delivered)</p>
              <DollarSign className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPrice(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Completed seller payouts</p>
              <Wallet className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPrice(completedPayoutTotal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/60 bg-[#0b1b14] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Pending payout queue</p>
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
              <h2 className="font-semibold text-emerald-200">Pending payouts</h2>
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
              <h2 className="font-semibold text-emerald-200">Low stock inventory</h2>
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
          <h2 className="font-semibold text-emerald-200">Admin navigation</h2>
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
