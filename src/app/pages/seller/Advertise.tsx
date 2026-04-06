import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PaystackButton } from "react-paystack";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { BOOST_TIERS, type BoostTier } from "../../utils/boost";
import { verifyBoostPayment } from "../../utils/verifyBoostPayment";
import { isAutoAdsSubscriberEmail } from "../../utils/autoAdsSubscriber";
import { applyComplimentaryAdsBoost } from "../../utils/applyComplimentaryAdsBoost";

type SellerProductRow = {
  id: number;
  title: string;
  image: string | null;
  boost_expires_at: string | null;
  boost_tier: string | null;
};

export default function Advertise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preProductId = searchParams.get("productId");
  const { user } = useAuth();

  const [products, setProducts] = useState<SellerProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<BoostTier | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, image, boost_expires_at, boost_tier")
      .eq("seller_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error(error.message);
      setProducts([]);
    } else {
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        title: String(r.title ?? ""),
        image: (r.image as string | null) ?? null,
        boost_expires_at: (r.boost_expires_at as string | null) ?? null,
        boost_tier: (r.boost_tier as string | null) ?? null,
      }));
      setProducts(rows.filter((x) => Number.isFinite(x.id)));
    }
    setLoadingProducts(false);
  }, [user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const raw = preProductId?.trim();
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) setSelectedProductId(n);
  }, [preProductId]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const tierInfo = useMemo(() => BOOST_TIERS.find((t) => t.id === selectedTier) ?? null, [selectedTier]);

  const amountKobo = tierInfo ? tierInfo.priceNgn * 100 : 0;

  const preparePayment = () => {
    if (!selectedProductId || !selectedTier || !user?.id) {
      toast.message("Choose a listing and a boost tier.");
      return;
    }
    setPaymentRef(`gh_boost_${selectedProductId}_${selectedTier}_${Date.now()}`);
  };

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ?? "";
  const complimentaryAds = isAutoAdsSubscriberEmail(user?.email ?? null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="px-4 py-3 max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Boost a listing</h1>
            <p className="text-xs text-gray-500">One-time payment · No subscription · Same listing can be extended</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl border border-[#22c55e]/25 bg-[#f0fdf4] px-4 py-3 text-sm text-gray-700">
          Pay once per boost. We verify your payment with Paystack, then your listing moves up in search and shows a
          boost badge until the period ends.
        </div>

        {complimentaryAds ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
            <p className="font-semibold text-emerald-900">Complimentary ads on your account</p>
            <p className="mt-1 text-emerald-900/90">
              Choose a listing and tier below, then activate — no Paystack payment. Access is tied to your signed-in
              email.
            </p>
          </div>
        ) : null}

        {loadingProducts ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-600">
            <p className="mb-4">You need at least one active listing to boost.</p>
            <button
              type="button"
              onClick={() => navigate("/seller/products/new")}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
            >
              Add a product
            </button>
          </div>
        ) : (
          <>
            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">1. Choose listing</h2>
              <select
                value={selectedProductId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedProductId(v ? parseInt(v, 10) : null);
                  setPaymentRef(null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.slice(0, 80)}
                    {p.title.length > 80 ? "…" : ""}
                  </option>
                ))}
              </select>
              {selectedProduct?.boost_expires_at &&
              new Date(selectedProduct.boost_expires_at).getTime() > Date.now() ? (
                <p className="mt-2 text-xs text-amber-800">
                  This listing already has an active boost (
                  {selectedProduct.boost_tier ?? "tier"}) until{" "}
                  {new Date(selectedProduct.boost_expires_at).toLocaleString()}. Buying again adds time.
                </p>
              ) : null}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">2. Choose boost tier</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {BOOST_TIERS.map((t) => {
                  const active = selectedTier === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTier(t.id);
                        setPaymentRef(null);
                      }}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        active ? "border-[#22c55e] bg-green-50 shadow-sm" : "border-gray-200 hover:border-[#22c55e]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900">{t.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t.durationLabel}</p>
                        </div>
                        {active ? <CheckCircle2 className="w-5 h-5 text-[#22c55e] shrink-0" /> : null}
                      </div>
                        <p className="mt-3 text-lg font-bold text-[#15803d]">
                          {complimentaryAds ? "Complimentary" : `₦${t.priceNgn.toLocaleString()}`}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {complimentaryAds ? "Included for your account" : "NGN · Paystack"}
                        </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">{complimentaryAds ? "3. Activate" : "3. Pay"}</h2>

              {complimentaryAds ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedProductId || !selectedTier) {
                        toast.message("Choose a listing and a boost tier.");
                        return;
                      }
                      setVerifying(true);
                      try {
                        const out = await applyComplimentaryAdsBoost(selectedProductId, selectedTier);
                        if (out.error) {
                          toast.error(out.error);
                          return;
                        }
                        toast.success("Boost activated on your listing at no charge.");
                        await loadProducts();
                        navigate(`/products/${selectedProductId}`);
                      } finally {
                        setVerifying(false);
                      }
                    }}
                    disabled={!selectedProductId || !selectedTier || verifying}
                    className="w-full rounded-xl bg-[#15803d] py-3.5 font-bold text-white shadow-sm hover:bg-[#166534] disabled:opacity-50"
                  >
                    {verifying ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Applying…
                      </span>
                    ) : (
                      "Activate boost (complimentary)"
                    )}
                  </button>
                  <p className="text-xs text-gray-500">
                    Applies the same visibility as a paid boost. Requires the complimentary-ads migration on your
                    Supabase project.
                  </p>
                </>
              ) : (
                <>
                  {!publicKey ? (
                    <p className="text-sm text-amber-800">Set VITE_PAYSTACK_PUBLIC_KEY to enable checkout.</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={preparePayment}
                    disabled={!selectedProductId || !selectedTier || !publicKey}
                    className="w-full rounded-xl border-2 border-[#22c55e] py-3 font-bold text-[#15803d] hover:bg-[#22c55e]/10 disabled:opacity-50"
                  >
                    {paymentRef ? "Payment ready — use the button below" : "Prepare Paystack checkout"}
                  </button>

                  {paymentRef && tierInfo && selectedProductId ? (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-gray-600">
                        Total: <span className="font-bold text-gray-900">₦{tierInfo.priceNgn.toLocaleString()}</span>
                      </p>
                      <PaystackButton
                        key={paymentRef}
                        email={user?.email || "seller@greenhub.app"}
                        amount={amountKobo}
                        publicKey={publicKey}
                        text={verifying ? "Verifying…" : "Pay now"}
                        reference={paymentRef}
                        currency="NGN"
                        channels={["card"]}
                        metadata={{
                          product_id: selectedProductId,
                          boost_tier: selectedTier,
                        }}
                        disabled={verifying}
                        onSuccess={async (res: { reference?: string } | string) => {
                          const ref =
                            typeof res === "string"
                              ? res
                              : String((res as { reference?: string })?.reference ?? paymentRef);
                          if (!selectedTier) return;
                          setVerifying(true);
                          try {
                            const out = await verifyBoostPayment(ref, selectedProductId, selectedTier);
                            if (out.error) {
                              toast.error(out.error);
                              return;
                            }
                            toast.success(out.message || "Boost activated! Your product is now featured.");
                            setPaymentRef(null);
                            await loadProducts();
                            navigate(`/products/${selectedProductId}`);
                          } finally {
                            setVerifying(false);
                          }
                        }}
                        onClose={() => toast.message("Checkout closed")}
                        className="w-full bg-[#092b23] text-white px-6 py-4 rounded-xl font-bold hover:bg-[#061d18] transition-colors disabled:opacity-50"
                      />
                    </div>
                  ) : null}

                  <div className="flex items-start gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <TrendingUp className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <span>
                      After payment we call Paystack to verify the reference, then update your listing. If anything
                      fails, check that the Edge Function <code className="text-[11px]">verify-boost-payment</code> is
                      deployed and <code className="text-[11px]">PAYSTACK_SECRET_KEY</code> is set in Supabase.
                    </span>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
