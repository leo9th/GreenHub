import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { supabase } from "../../../lib/supabase";

type SellerTab = "new" | "active" | "completed";

type ProductRow = {
  id: number | string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: number | string | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  status: string | null;
  price_at_time?: number | null;
  unit_price?: number | null;
  created_at?: string | null;
};

type OrderRow = {
  id: string;
  created_at: string | null;
  buyer_id: string | null;
};

type SellerOrderCard = {
  itemId: string;
  orderId: string;
  title: string;
  image: string | null;
  quantity: number;
  status: string;
  lineTotal: number;
  createdAt: string | null;
  buyerLabel: string;
};

function unitPrice(it: OrderItemRow): number {
  return Number(it.price_at_time ?? it.unit_price) || 0;
}

function toStatusGroup(raw: string | null | undefined): SellerTab | null {
  const s = String(raw || "").toLowerCase();
  if (s === "pending" || s === "processing") return "new";
  if (s === "shipped") return "active";
  if (s === "delivered" || s === "cancelled") return "completed";
  return null;
}

function quickUpdateForStatus(status: string): { label: string; nextStatus: "processing" | "shipped" } | null {
  if (status === "pending") return { label: "Start Processing", nextStatus: "processing" };
  if (status === "processing") return { label: "Mark as Shipped", nextStatus: "shipped" };
  return null;
}

export default function SellerOrderManagement() {
  const formatPrice = useCurrency();
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SellerTab>("new");
  const [cards, setCards] = useState<SellerOrderCard[]>([]);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [expandedEarningsItemId, setExpandedEarningsItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sellerId = authUser?.id?.trim();
    if (!sellerId) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", sellerId);

      if (pErr) throw pErr;

      const productIds = (products ?? [])
        .map((p) => (p as ProductRow).id)
        .filter((id): id is string | number => id != null);

      if (productIds.length === 0) {
        setCards([]);
        return;
      }

      const { data: itemRows, error: iErr } = await supabase
        .from("order_items")
        .select("*")
        .in("product_id", productIds);

      if (iErr) throw iErr;

      const items = (itemRows ?? []) as OrderItemRow[];
      const scopedItems = items.filter((it) => toStatusGroup(it.status) !== null);
      const orderIds = [...new Set(scopedItems.map((it) => String(it.order_id || "").trim()).filter(Boolean))];

      if (orderIds.length === 0) {
        setCards([]);
        return;
      }

      const { data: orderRows, error: oErr } = await supabase.from("orders").select("*").in("id", orderIds);
      if (oErr) throw oErr;

      const orders = (orderRows ?? []) as OrderRow[];
      const orderMap = new Map<string, OrderRow>();
      for (const o of orders) orderMap.set(String(o.id), o);

      const buyerIds = [...new Set(orders.map((o) => o.buyer_id).filter(Boolean))] as string[];
      const buyerNameMap = new Map<string, string>();
      if (buyerIds.length > 0) {
        const { data: profs } = await supabase.from("profiles_public").select("*").in("id", buyerIds);
        for (const p of profs ?? []) {
          if (p.id) buyerNameMap.set(String(p.id), String(p.full_name || "Buyer"));
        }
      }

      const nextCards: SellerOrderCard[] = scopedItems
        .map((it) => {
          const order = orderMap.get(String(it.order_id));
          const q = Math.max(0, Number(it.quantity) || 0);
          const status = String(it.status || "pending").toLowerCase();
          return {
            itemId: String(it.id),
            orderId: String(it.order_id),
            title: it.product_title?.trim() || "Product",
            image: it.product_image || null,
            quantity: q,
            status,
            lineTotal: q * unitPrice(it),
            createdAt: order?.created_at ?? it.created_at ?? null,
            buyerLabel: order?.buyer_id ? buyerNameMap.get(order.buyer_id) || "Buyer" : "Buyer",
          };
        })
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });

      setCards(nextCards);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load seller orders");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return {
      new: cards.filter((c) => toStatusGroup(c.status) === "new"),
      active: cards.filter((c) => toStatusGroup(c.status) === "active"),
      completed: cards.filter((c) => toStatusGroup(c.status) === "completed"),
    };
  }, [cards]);

  const handleQuickUpdate = useCallback(
    async (row: SellerOrderCard) => {
      const sellerId = authUser?.id?.trim();
      if (!sellerId) return;
      const quick = quickUpdateForStatus(row.status);
      if (!quick) return;

      setUpdatingItemId(row.itemId);
      try {
        const { error: updateErr } = await supabase
          .from("order_items")
          .update({ status: quick.nextStatus })
          .eq("id", row.itemId)
          .eq("seller_id", sellerId);
        if (updateErr) throw updateErr;

        const { error: eventErr } = await supabase.from("order_events").insert({
          order_id: row.orderId,
          event_label: `Seller has marked item as ${quick.nextStatus.charAt(0).toUpperCase()}${quick.nextStatus.slice(1)}`,
          metadata: {
            order_item_id: row.itemId,
            seller_id: sellerId,
            from_status: row.status,
            to_status: quick.nextStatus,
            seller_action: true,
          },
        });
        if (eventErr) throw eventErr;

        toast.success("Order item updated");
        await load();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not update order item");
      } finally {
        setUpdatingItemId(null);
      }
    },
    [authUser?.id, load],
  );

  const list = grouped[activeTab];

  return (
    <section className="border-t border-gray-100 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Seller Action Center</h2>
        <span className="text-xs text-gray-400">{cards.length} line items</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === "new"
              ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#166534]"
              : "border-gray-100 bg-gray-50/80 text-gray-700 hover:bg-gray-100"
          }`}
        >
          New Orders ({grouped.new.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === "active"
              ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#166534]"
              : "border-gray-100 bg-gray-50/80 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Active Shipments ({grouped.active.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === "completed"
              ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#166534]"
              : "border-gray-100 bg-gray-50/80 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Completed ({grouped.completed.length})
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#22c55e]" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No items in this tab yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((row) => (
            <div key={row.itemId} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <Link to={`/orders/${row.orderId}`} className="flex items-center gap-3 hover:bg-gray-50">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {row.image ? (
                    <img src={row.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-gray-900">{row.title}</p>
                  <p className="text-xs text-gray-500">
                    {row.buyerLabel} · Qty {row.quantity} · {row.status}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#15803d]">{formatPrice(row.lineTotal)}</p>
                </div>
              </Link>
              {(() => {
                const subtotal = row.lineTotal;
                const platformFee = subtotal * 0.1;
                const netEarnings = subtotal - platformFee;
                const isExpanded = expandedEarningsItemId === row.itemId;
                return (
                  <div className="mt-3 border-t border-gray-200/70 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700">Net Earnings: {formatPrice(netEarnings)}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedEarningsItemId((prev) => (prev === row.itemId ? null : row.itemId))}
                        className="text-xs font-medium text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-700"
                      >
                        {isExpanded ? "Hide summary" : "Payout Summary"}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Payout Summary</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex items-center justify-between">
                            <span>Customer Price</span>
                            <span>{formatPrice(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>GreenHub Fee (10%)</span>
                            <span>-{formatPrice(platformFee)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1.5 text-sm font-bold text-[#15803d]">
                            <span>Final Payout</span>
                            <span>{formatPrice(netEarnings)}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              <div className="mt-3 flex justify-end">
                {quickUpdateForStatus(row.status) ? (
                  <button
                    type="button"
                    onClick={() => void handleQuickUpdate(row)}
                    disabled={updatingItemId === row.itemId}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#22c55e] px-3 py-1.5 text-xs font-semibold text-[#15803d] hover:bg-[#22c55e]/10 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {updatingItemId === row.itemId ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      quickUpdateForStatus(row.status)?.label
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
