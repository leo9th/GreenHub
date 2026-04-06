import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useCurrency } from "../../hooks/useCurrency";
import { BOOST_TIERS, type BoostTier } from "../../utils/boost";
import { toast } from "sonner";

type TxRow = {
  id: string;
  seller_id: string | null;
  product_id: number | null;
  amount: number | null;
  duration_days: number | null;
  boost_tier: string | null;
  status: string | null;
  payment_reference: string | null;
  created_at: string | null;
  notes: string | null;
  products?: { title: string | null } | null;
};

export default function AdminBoosts() {
  const formatPrice = useCurrency();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantPid, setGrantPid] = useState("");
  const [grantTier, setGrantTier] = useState<BoostTier>("weekly");
  const [grantBusy, setGrantBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("boost_transactions")
      .select("id, seller_id, product_id, amount, duration_days, boost_tier, status, payment_reference, created_at, notes, products(title)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (e) {
      setError(e.message);
      setRows([]);
    } else {
      setRows((data ?? []) as TxRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refund = async (id: string) => {
    if (!confirm("Refund this boost? The listing’s boost will be cleared.")) return;
    const { error: e } = await supabase.rpc("admin_refund_boost_transaction", {
      p_transaction_id: id,
      p_notes: "Refunded by admin",
    });
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Marked as refunded and boost cleared.");
    void load();
  };

  const grant = async () => {
    const pid = parseInt(grantPid.trim(), 10);
    if (!Number.isFinite(pid) || pid < 1) {
      toast.message("Enter a valid product ID.");
      return;
    }
    const tier = BOOST_TIERS.find((t) => t.id === grantTier);
    if (!tier) return;
    setGrantBusy(true);
    try {
      const { error: e } = await supabase.rpc("admin_grant_product_boost", {
        p_product_id: pid,
        p_tier: grantTier,
        p_duration_days: tier.durationDays,
        p_notes: "Granted by admin",
      });
      if (e) {
        toast.error(e.message);
        return;
      }
      toast.success("Boost granted.");
      setGrantPid("");
      void load();
    } finally {
      setGrantBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-4 max-w-6xl mx-auto flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 text-gray-600 hover:text-[#16a34a]" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Boost transactions</h1>
            <p className="text-sm text-gray-600">View payments, refund, or grant boosts (admin only)</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </header>

      <div className="px-4 py-6 max-w-6xl mx-auto space-y-8">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Manual grant</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product ID</label>
              <input
                value={grantPid}
                onChange={(e) => setGrantPid(e.target.value)}
                placeholder="e.g. 42"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tier</label>
              <select
                value={grantTier}
                onChange={(e) => setGrantTier(e.target.value as BoostTier)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {BOOST_TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.durationDays}d)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={grantBusy}
              onClick={() => void grant()}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a] disabled:opacity-50"
            >
              {grantBusy ? "Saving…" : "Grant boost"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
            <p className="mt-2 text-xs">
              If you see a policy error, confirm your account has{" "}
              <code className="rounded bg-amber-100 px-1">app_metadata.role = admin</code> in Supabase Auth.
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="p-3">When</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ref</th>
                  <th className="p-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      {t.product_id ? (
                        <Link className="text-[#15803d] hover:underline" to={`/products/${t.product_id}`}>
                          {t.products?.title ?? `#${t.product_id}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{t.boost_tier ?? "—"}</td>
                    <td className="p-3 tabular-nums">{formatPrice(Number(t.amount ?? 0))}</td>
                    <td className="p-3 text-xs">{t.status ?? "—"}</td>
                    <td className="p-3 text-xs font-mono truncate max-w-[120px]" title={t.payment_reference ?? ""}>
                      {t.payment_reference ?? "—"}
                    </td>
                    <td className="p-3">
                      {t.status === "success" ? (
                        <button
                          type="button"
                          onClick={() => void refund(t.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Refund
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="p-6 text-center text-gray-500 text-sm">No transactions yet.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
