import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Package, Store, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../../hooks/useCurrency";
import { supabase } from "../../../lib/supabase";

type OrderRevenueRow = {
  total_amount?: number | null;
  total_price?: number | null;
  amount?: number | null;
};

function asMoney(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminDashboard() {
  const formatPrice = useCurrency();
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeSellers, setActiveSellers] = useState(0);
  const [platformRevenue, setPlatformRevenue] = useState(0);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [{ count: productCount, error: productErr }, { data: deliveredOrders, error: deliveredErr }, { data: activeRows, error: activeErr }] =
        await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("total_amount, total_price, amount")
            .in("status", ["delivered", "completed"]),
          supabase.from("products").select("seller_id").eq("status", "active"),
        ]);

      if (productErr) throw productErr;
      if (deliveredErr) throw deliveredErr;
      if (activeErr) throw activeErr;

      setTotalProducts(typeof productCount === "number" ? productCount : 0);

      const sellerIds = new Set<string>();
      for (const row of activeRows ?? []) {
        const sid = (row as { seller_id?: string | null }).seller_id;
        if (sid) sellerIds.add(String(sid));
      }
      setActiveSellers(sellerIds.size);

      const delivered = (deliveredOrders ?? []) as OrderRevenueRow[];
      const grossDelivered = delivered.reduce((sum, row) => {
        const raw = row.total_amount ?? row.total_price ?? row.amount ?? 0;
        return sum + asMoney(raw);
      }, 0);
      setPlatformRevenue(grossDelivered * 0.1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load dashboard stats");
      setTotalProducts(0);
      setActiveSellers(0);
      setPlatformRevenue(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0b1220]">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" aria-hidden />
        <span className="sr-only">Loading stats…</span>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-[#0b1220] via-[#0d1629] to-[#0b1220] pb-12 pt-8 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-300 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-emerald-100/60">Platform overview at a glance</p>
        </div>

        <section aria-label="Key statistics" className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          <StatCard
            label="Total Products"
            value={String(totalProducts.toLocaleString())}
            icon={<Package className="h-5 w-5 text-emerald-400/90" aria-hidden />}
          />
          <StatCard
            label="Active Sellers"
            value={String(activeSellers.toLocaleString())}
            icon={<Store className="h-5 w-5 text-emerald-400/90" aria-hidden />}
            hint="Sellers with at least one active listing"
          />
          <StatCard
            label="Platform Revenue (10%)"
            value={formatPrice(platformRevenue)}
            icon={<DollarSign className="h-5 w-5 text-emerald-400/90" aria-hidden />}
            hint="10% of delivered & completed order totals"
          />
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-emerald-500/20 bg-slate-900/45 p-5 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.06),0_12px_40px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/85">{label}</p>
        <div className="shrink-0 rounded-lg border border-emerald-500/15 bg-emerald-950/40 p-2">{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-emerald-300 sm:text-4xl">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-snug text-emerald-100/50">{hint}</p> : null}
    </article>
  );
}
