import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useCurrency } from "../../hooks/useCurrency";
import type { BoostTier } from "../../utils/boost";
import { BOOST_TIERS } from "../../utils/boost";
import { toast } from "sonner";

type TxRow = {
  id: string;
  seller_id: string;
  product_id: number;
  amount: number;
  duration_days: number;
  boost_tier: string;
  status: string;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  products: { title: string | null } | null;
};

export default function AdminBoosts() {
  const formatPrice = useCurrency();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [grantProductId, setGrantProductId] = useState("");
  const [grantTier, setGrantTier] = useState<BoostTier>("daily");
  const [grantDays, setGrantDays] = useState("7");
  const [grantNotes, setGrantNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("boost_transactions")
      .select("id, seller_id, product_id, amount, duration_days, boost_tier, status, payment_reference, notes, created_at, products ( title )")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as TxRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runGrant = async () => {
    const pid = parseInt(grantProductId.trim(), 10);
    const days = parseInt(grantDays.trim(), 10);
    if (!Number.isFinite(pid) || pid < 1) {
      toast.error("Enter a valid product ID");
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Enter duration days (≥ 1)");
      return;
    }
    setBusyId("grant");
    try {
      const { data, error } = await supabase.rpc("admin_grant_product_boost", {
        p_product_id: pid,
        p_tier: grantTier,
        p_duration_days: days,
        p_notes: grantNotes.trim() || null,
      });
      if (error) throw error;
      toast.success("Boost granted");
      setGrantProductId("");
      setGrantNotes("");
      void load();
      console.log(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Grant failed (admin JWT required)");
    } finally {
      setBusyId(null);
    }
  };

  const runClear = async (productId: number) => {
    if (!confirm(`Clear boost on product #${productId}?`)) return;
    setBusyId(`clear-${productId}`);
    try {
      const { error } = await supabase.rpc("admin_clear_product_boost", {
        p_product_id: productId,
        p_notes: "Cleared from admin boosts UI",
      });
      if (error) throw error;
      toast.success("Boost cleared");
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusyId(null);
    }
  };

  const runRefund = async (txId: string) => {
    if (!confirm("Mark this transaction refunded and clear the listing boost?")) return;
    setBusyId(`refund-${txId}`);
    try {
      const { error } = await supabase.rpc("admin_refund_boost_transaction", {
        p_transaction_id: txId,
        p_notes: "Refunded from admin UI",
      });
      if (error) throw error;
      toast.success("Marked refunded");
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3 max-w-6xl mx-auto flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">Boost transactions</h1>
            <p className="text-xs text-gray-500">Requires Supabase user with app_metadata.role = admin</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-800">Grant boost manually</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-gray-600">
              Product ID
              <input
                value={grantProductId}
                onChange={(e) => setGrantProductId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                placeholder="e.g. 42"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Tier
              <select
                value={grantTier}
                onChange={(e) => setGrantTier(e.target.value as BoostTier)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                {BOOST_TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-600">
              Duration (days)
              <input
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-gray-600 sm:col-span-2 lg:col-span-1">
              Notes
              <input
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => void runGrant()}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-bold text-white hover:bg-[#16a34a] disabled:opacity-50"
          >
            Grant boost
          </button>
        </section>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="p-3">Created</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <span className="line-clamp-2">{r.products?.title ?? `#${r.product_id}`}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">#{r.product_id}</span>
                    </td>
                    <td className="p-3">{r.boost_tier}</td>
                    <td className="p-3 tabular-nums">{formatPrice(r.amount)}</td>
                    <td className="p-3 text-xs font-semibold uppercase">{r.status}</td>
                    <td className="p-3 max-w-[120px] truncate text-xs text-gray-500">
                      {r.payment_reference ?? "—"}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      {r.status === "success" ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void runRefund(r.id)}
                          className="text-xs font-bold text-amber-700 hover:underline disabled:opacity-50"
                        >
                          Refund
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runClear(r.product_id)}
                        className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Clear product boost
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
