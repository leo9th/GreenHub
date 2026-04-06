import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { isBoostActive } from "../../utils/boost";

type ProductBoostRow = {
  id: number;
  title: string;
  boost_expires_at: string | null;
  boost_tier: string | null;
  boost_count: number;
};

type TxRow = {
  id: string;
  product_id: number;
  amount: number;
  duration_days: number;
  boost_tier: string;
  status: string;
  payment_reference: string | null;
  created_at: string;
};

export default function MyBoosts() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const formatPrice = useCurrency();
  const [products, setProducts] = useState<ProductBoostRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setTxs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data: prodData, error: pe } = await supabase
        .from("products")
        .select("id, title, boost_expires_at, boost_tier, boost_count")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      if (pe) throw pe;
      setProducts(
        (prodData ?? []).map((r: Record<string, unknown>) => ({
          id: Number(r.id),
          title: String(r.title ?? ""),
          boost_expires_at: (r.boost_expires_at as string | null) ?? null,
          boost_tier: (r.boost_tier as string | null) ?? null,
          boost_count: Math.max(0, Number(r.boost_count ?? 0)),
        })),
      );

      const { data: txData, error: te } = await supabase
        .from("boost_transactions")
        .select("id, product_id, amount, duration_days, boost_tier, status, payment_reference, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (te) throw te;
      setTxs(
        (txData ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          product_id: Number(r.product_id),
          amount: Number(r.amount ?? 0),
          duration_days: Number(r.duration_days ?? 0),
          boost_tier: String(r.boost_tier ?? ""),
          status: String(r.status ?? ""),
          payment_reference: r.payment_reference != null ? String(r.payment_reference) : null,
          created_at: String(r.created_at ?? ""),
        })),
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load boosts");
      setProducts([]);
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [user, authLoading, navigate]);

  const { active, expired } = useMemo(() => {
    const act: ProductBoostRow[] = [];
    const exp: ProductBoostRow[] = [];
    for (const p of products) {
      if (isBoostActive(p.boost_expires_at)) act.push(p);
      else if (p.boost_count > 0 || p.boost_expires_at) exp.push(p);
    }
    return { active: act, expired: exp };
  }, [products]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3 max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/seller/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-800">My boosts</h1>
            <p className="text-xs text-gray-500">Active placements, past boosts, and payment history</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/seller/advertise"
            className="inline-flex items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#16a34a]"
          >
            <TrendingUp className="w-4 h-4" />
            Buy a boost
          </Link>
        </div>

        {err ? (
          <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-4 py-3">{err}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Active</h2>
              {active.length === 0 ? (
                <p className="text-sm text-gray-600 bg-white rounded-xl border border-gray-200 p-4">
                  No active boosts. Promote a listing to appear higher in search.
                </p>
              ) : (
                <ul className="space-y-2">
                  {active.map((p) => {
                    const exp = p.boost_expires_at ? new Date(p.boost_expires_at) : null;
                    const days =
                      exp && Number.isFinite(exp.getTime())
                        ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000))
                        : 0;
                    return (
                      <li key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <Link to={`/products/${p.id}`} className="font-medium text-gray-900 hover:text-[#15803d]">
                          {p.title}
                        </Link>
                        <p className="text-xs text-gray-600 mt-1">
                          Tier: <span className="font-semibold">{p.boost_tier}</span> · ~{days} day
                          {days === 1 ? "" : "s"} left
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Ends {exp ? exp.toLocaleString() : "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Expired / inactive</h2>
              {expired.length === 0 ? (
                <p className="text-sm text-gray-500">No past boosts on record.</p>
              ) : (
                <ul className="space-y-2">
                  {expired.slice(0, 20).map((p) => (
                    <li key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 text-sm text-gray-700">
                      <Link to={`/products/${p.id}`} className="font-medium hover:text-[#15803d]">
                        {p.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">
                        Last tier: {p.boost_tier ?? "—"} · Purchases: {p.boost_count}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Purchase history</h2>
              {txs.length === 0 ? (
                <p className="text-sm text-gray-500">No boost payments yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="p-3">Date</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Tier</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((t) => {
                        const title = products.find((x) => x.id === t.product_id)?.title ?? `#${t.product_id}`;
                        return (
                          <tr key={t.id} className="border-b border-gray-50 last:border-0">
                            <td className="p-3 whitespace-nowrap text-gray-600">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="p-3 max-w-[140px] truncate">{title}</td>
                            <td className="p-3">{t.boost_tier}</td>
                            <td className="p-3 tabular-nums">{formatPrice(t.amount)}</td>
                            <td className="p-3">
                              <span className="text-xs font-semibold uppercase text-gray-700">{t.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
