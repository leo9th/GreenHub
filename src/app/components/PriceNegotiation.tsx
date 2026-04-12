import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export type ProductOfferRow = {
  id: string;
  product_id: string | number;
  buyer_id: string;
  offer_price: number;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  productId: string | number;
  listingPrice: number;
  sellerId: string;
  isOwner: boolean;
  formatPrice: (n: number | null | undefined) => string;
};

export function PriceNegotiation({ productId, listingPrice, sellerId, isOwner, formatPrice }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<ProductOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyerNames, setBuyerNames] = useState<Record<string, string>>({});

  /** Matches `products.id` in DB (UUID string or legacy numeric id). */
  const productPk = useMemo((): string | number | null => {
    if (productId == null) return null;
    if (typeof productId === "number") return Number.isFinite(productId) ? productId : null;
    const t = String(productId).trim();
    return t || null;
  }, [productId]);
  const pidOk = productPk != null;

  const loadOffers = useCallback(async () => {
    if (!pidOk) {
      setOffers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("product_offers")
      .select("*")
      .eq("product_id", productPk as string | number)
      .order("created_at", { ascending: false });

    if (error) {
      if (!String(error.message || "").toLowerCase().includes("does not exist")) {
        console.warn("product_offers:", error.message);
      }
      setOffers([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as ProductOfferRow[];
    setOffers(rows);

    if (isOwner && rows.length > 0) {
      const ids = [...new Set(rows.map((r) => r.buyer_id).filter(Boolean))];
      const { data: profs } = await supabase.from("profiles_public").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) {
        const id = String((p as { id?: string }).id ?? "");
        const name = String((p as { full_name?: string }).full_name ?? "").trim() || "Buyer";
        if (id) map[id] = name;
      }
      setBuyerNames(map);
    } else {
      setBuyerNames({});
    }

    setLoading(false);
  }, [pidOk, productPk, isOwner]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    if (!pidOk) return;

    const channel = supabase
      .channel(`product-offers:${String(productPk)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_offers",
          filter: `product_id=eq.${productPk}`,
        },
        () => {
          void loadOffers();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadOffers, productPk, pidOk]);

  const sendOffer = async () => {
    if (productPk == null) return;
    if (!user) {
      toast.message("Sign in to make an offer");
      navigate("/login");
      return;
    }
    const n = Number.parseFloat(String(amount).replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid offer amount");
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("product_offers")
        .select("id")
        .eq("product_id", productPk as string | number)
        .eq("buyer_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("product_offers")
          .update({
            offer_price: n,
            message: message.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Offer updated");
      } else {
        const { error } = await supabase.from("product_offers").insert({
          product_id: productPk,
          buyer_id: user.id,
          offer_price: n,
          message: message.trim() || null,
          status: "pending",
        });
        if (error) throw error;
        toast.success("Offer sent");
      }
      setAmount("");
      setMessage("");
      void loadOffers();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : "Could not send offer";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (offerId: string, status: "accepted" | "rejected") => {
    if (productPk == null) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("product_offers")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", offerId);
      if (error) throw error;

      if (status === "accepted") {
        await supabase
          .from("product_offers")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("product_id", productPk as string | number)
          .eq("status", "pending")
          .neq("id", offerId);
      }

      toast.success(status === "accepted" ? "Offer accepted" : "Offer rejected");
      void loadOffers();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : "Update failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (offerId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("product_offers").delete().eq("id", offerId);
      if (error) throw error;
      toast.success("Offer withdrawn");
      void loadOffers();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : "Could not withdraw";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!pidOk) return null;

  if (isOwner) {
    return (
      <div className="negotiation-bar">
        <h3 className="text-sm font-semibold text-gray-900">Offers on this listing</h3>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading offers…</p>
        ) : offers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No offers yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {offers.map((o) => (
              <li key={o.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatPrice(o.offer_price)}</p>
                    <p className="text-xs text-gray-500">{buyerNames[o.buyer_id] ?? "Buyer"}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      o.status === "pending"
                        ? "bg-amber-100 text-amber-900"
                        : o.status === "accepted"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                {o.message?.trim() ? <p className="mt-2 text-sm text-gray-700">{o.message.trim()}</p> : null}
                {o.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                      onClick={() => void respond(o.id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => void respond(o.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const myOffers = user ? offers.filter((o) => o.buyer_id === user.id) : [];

  return (
    <div className="negotiation-bar">
      <h3 className="text-sm font-semibold text-gray-900">Make an offer</h3>
      <p className="mt-1 text-xs text-gray-500">Listing price {formatPrice(listingPrice)} — suggest a price you&apos;re comfortable with.</p>

      {!user ? (
        <button
          type="button"
          className="send-offer-btn mt-3 w-full sm:w-auto"
          onClick={() => navigate("/login")}
        >
          Sign in to offer
        </button>
      ) : user.id === sellerId ? null : (
        <>
          <div className="offer-input-group">
            <input
              type="number"
              min={1}
              step={1}
              className="offer-input"
              placeholder="Your offer (₦)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="send-offer-btn shrink-0" disabled={busy} onClick={() => void sendOffer()}>
              {busy ? "…" : "Send offer"}
            </button>
          </div>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400"
            rows={2}
            placeholder="Optional message to the seller"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      {user && user.id !== sellerId ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your offers</h4>
          {loading ? (
            <p className="mt-2 text-sm text-gray-500">Loading…</p>
          ) : myOffers.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">You haven&apos;t made an offer on this item yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {myOffers.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-semibold tabular-nums">{formatPrice(o.offer_price)}</span>
                  <span className="text-xs font-medium uppercase text-gray-600">{o.status}</span>
                  {o.status === "pending" ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:underline"
                      disabled={busy}
                      onClick={() => void withdraw(o.id)}
                    >
                      Withdraw
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
