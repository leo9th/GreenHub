import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { buildApprovalTransition, buildRejectionTransition } from "../../utils/orderReviewTransition";

type ReviewOrderRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  total_amount: number | null;
  buyer_id: string | null;
  payment_method: string | null;
};

export default function OrderReviews() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<ReviewOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, created_at, status, total_amount, buyer_id, payment_method")
      .eq("status", "needs_review")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as ReviewOrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => orders.length, [orders]);

  const applyTransition = useCallback(
    async (orderId: string, transition: ReturnType<typeof buildApprovalTransition>) => {
      setSavingOrderId(orderId);
      setError(null);

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: transition.nextStatus })
        .eq("id", orderId)
        .eq("status", "needs_review");

      if (updateError) {
        setError(updateError.message);
        setSavingOrderId(null);
        return;
      }

      const { error: eventError } = await supabase.from("order_events").insert({
        order_id: orderId,
        event_label: transition.eventLabel,
        metadata: transition.metadata,
      });

      if (eventError) {
        setError(eventError.message);
      }

      await load();
      setSavingOrderId(null);
    },
    [load],
  );

  const handleApprove = async (orderId: string) => {
    const transition = buildApprovalTransition(user?.id ?? null);
    await applyTransition(orderId, transition);
  };

  const handleReject = async (orderId: string) => {
    const reason = (reasons[orderId] ?? "").trim();
    if (!reason) {
      setError("A rejection reason is required.");
      return;
    }
    const transition = buildRejectionTransition(reason, user?.id ?? null);
    await applyTransition(orderId, transition);
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-emerald-200">Order Review Queue</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Review C2C high-value orders before payment is finalized. Pending: {pendingCount}
        </p>
      </header>

      {error ? <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-emerald-200">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-emerald-400/20 bg-[#0f1a2d] px-4 py-8 text-center text-sm text-emerald-100/80">
          No orders are waiting for review.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const disabled = savingOrderId === order.id;
            return (
              <article key={order.id} className="rounded-xl border border-emerald-400/20 bg-[#0f1a2d] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-emerald-100">{order.id}</p>
                    <p className="text-xs text-emerald-200/80">
                      Buyer: {order.buyer_id ?? "Unknown"} | Payment channel: {order.payment_method ?? "N/A"}
                    </p>
                    <p className="text-xs text-emerald-200/80">
                      Total: {Number(order.total_amount ?? 0).toLocaleString()} | Created:{" "}
                      {order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">
                    needs_review
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <input
                    value={reasons[order.id] ?? ""}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Reason if rejecting this order"
                    className="rounded-lg border border-emerald-400/30 bg-[#0b1220] px-3 py-2 text-sm text-emerald-50 outline-none placeholder:text-emerald-300/40 focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleApprove(order.id)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleReject(order.id)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
