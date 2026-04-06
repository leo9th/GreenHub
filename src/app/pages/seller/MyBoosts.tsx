import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { getBoostTier, isBoostActive } from "../../utils/boost";

type TxRow = {
  id: string;
  amount: number | null;
  duration_days: number | null;
  boost_tier: string | null;
  status: string | null;
  payment_reference: string | null;
  created_at: string | null;
  product_id: number | null;
  products?: { title: string | null } | null;
};

type ProductBoostRow = {
  id: number;
  title: string | null;
  boost_expires_at: string | null;
  boost_tier: string | null;
  boost_count: number | null;
};

export default function MyBoosts() {
  const navigate = useNavigate();
  const formatPrice = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductBoostRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setTxs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pRes, tRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, boost_expires_at, boost_tier, boost_count")
          .eq("seller_id", user.id)
          .gt("boost_count", 0)
          .order("boost_expires_at", { ascending: false }),
        supabase
          .from("boost_transactions")
          .select("id, amount, duration_days, boost_tier, status, payment_reference, created_at, product_id, products(title)")
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (pRes.error) throw pRes.error;
      if (tRes.error) throw tRes.error;

      setProducts((pRes.data ?? []) as ProductBoostRow[]);
      setTxs((tRes.data ?? []) as TxRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load boosts");
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
    const a: ProductBoostRow[] = [];
    const e: ProductBoostRow[] = [];
    for (const p of products) {
      if (isBoostActive(p.boost_expires_at)) a.push(p);
      else if (p.boost_expires_at) e.push(p);
    }
    return { active: a, expired: e };
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
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">My boosts</h1>
            <p className="text-xs text-gray-500">Active placements, expired boosts, and purchase history</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <Link
          to="/seller/advertise"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#22c55e] text-white py-3 font-bold hover:bg-[#16a34a] shadow-sm"
        >
          <TrendingUp className="w-5 h-5" />
          Buy a new boost
        </Link>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Active boosts</h2>
              {active.length === 0 ? (
                <p className="text-sm text-gray-500">No active boosts right now.</p>
              ) : (
                <ul className="space-y-2">
                  {active.map((p) => {
                    const tier = getBoostTier(p.boost_tier ?? undefined);
                    const exp = p.boost_expires_at ? new Date(p.boost_expires_at) : null;
                    const daysLeft =
                      exp && !Number.isNaN(exp.getTime())
                        ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000))
                        : 0;
                    return (
                      <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
                        <Link to={`/products/${p.id}`} className="font-medium text-gray-900 hover:text-[#15803d]">
                          {p.title ?? "Listing"}
                        </Link>
                        <p className="text-xs text-gray-600 mt-1">
                          {tier?.label ?? p.boost_tier} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left · ends{" "}
                          {exp?.toLocaleString()}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Expired boosts (on your listings)</h2>
              {expired.length === 0 ? (
                <p className="text-sm text-gray-500">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {expired.map((p) => (
                    <li key={p.id} className="rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                      <Link to={`/products/${p.id}`} className="font-medium hover:text-[#15803d]">
                        {p.title ?? "Listing"}
                      </Link>
                      <span className="text-gray-400"> · ended {p.boost_expires_at ? new Date(p.boost_expires_at).toLocaleDateString() : "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Purchase history</h2>
              {txs.length === 0 ? (
                <p className="text-sm text-gray-500">No boost payments recorded.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                        <th className="p-3">When</th>
                        <th className="p-3">Listing</th>
                        <th className="p-3">Tier</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((t) => (
                        <tr key={t.id} className="border-b border-gray-50 last:border-0">
                          <td className="p-3 whitespace-nowrap text-gray-600">
                            {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                          </td>
                          <td className="p-3">
                            {t.product_id ? (
                              <Link to={`/products/${t.product_id}`} className="text-[#15803d] hover:underline">
                                {t.products?.title ?? `#${t.product_id}`}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3">{t.boost_tier ?? "—"}</td>
                          <td className="p-3 tabular-nums">{formatPrice(Number(t.amount ?? 0))}</td>
                          <td className="p-3 text-xs">{t.status ?? "—"}</td>
                        </tr>
                      ))}
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
