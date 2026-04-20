import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle,
  Star,
  Package,
  Store,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../hooks/useCurrency";
import { getAvatarUrl } from "../utils/getAvatar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { isWarehouseShippingFulfillment } from "../utils/fulfillment";

type OrderRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  total_amount: number | null;
  delivery_fee: number | null;
  platform_fee: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  shipping_address: Record<string, unknown> | null;
  buyer_id?: string | null;
};

type LineItemStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | number | null;
  seller_id: string | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  price_at_time: number | null;
  delivery_fee_at_time: number | null;
  fulfillment_type?: string | null;
  status?: string | null;
  tracking_ref?: string | null;
};

type OrderEventRow = {
  id: string;
  event_label: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type SellerLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
  phone: string | null;
};

const LINE_STATUS_OPTIONS: { value: LineItemStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const FULFILLMENT_PHASE_ORDER: LineItemStatus[] = ["pending", "processing", "shipped", "delivered"];

function normalizeLineStatus(raw: string | null | undefined): LineItemStatus {
  const s = String(raw || "pending").toLowerCase();
  if (s === "processing" || s === "shipped" || s === "delivered" || s === "cancelled" || s === "pending") {
    return s;
  }
  return "pending";
}

function isForwardPhase(prev: LineItemStatus, next: LineItemStatus): boolean {
  const iPrev = FULFILLMENT_PHASE_ORDER.indexOf(prev);
  const iNext = FULFILLMENT_PHASE_ORDER.indexOf(next);
  if (iPrev < 0 || iNext < 0) return false;
  return iNext > iPrev;
}

function eventLabelForLineStatus(status: LineItemStatus, productTitle: string): string {
  const title = productTitle.trim() || "Item";
  switch (status) {
    case "pending":
      return `${title}: set to pending by seller`;
    case "processing":
      return `${title}: processing by seller`;
    case "shipped":
      return `Item has been shipped by seller — ${title}`;
    case "delivered":
      return `${title}: marked delivered by seller`;
    case "cancelled":
      return `${title}: cancelled by seller`;
    default:
      return `${title}: status updated by seller`;
  }
}

function shippingLines(addr: Record<string, unknown> | null): { fullName: string; phone: string; address: string; state: string; lga: string } {
  if (!addr || typeof addr !== "object") {
    return { fullName: "—", phone: "—", address: "—", state: "—", lga: "—" };
  }
  return {
    fullName: String(addr.fullName ?? addr.full_name ?? "—"),
    phone: String(addr.phone ?? "—"),
    address: String(addr.address ?? "—"),
    state: String(addr.state ?? "—"),
    lga: String(addr.lga ?? "—"),
  };
}

function paymentMethodLabel(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase();
  if (s === "paystack") return "Paystack";
  if (s === "pod") return "Pay on delivery";
  return raw?.trim() || "—";
}

function formatOrderEventTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${hh}:${min} - ${day}/${month}/${year}`;
}

function displayEventLabel(eventLabel: string, hasGuaranteed: boolean): string {
  const t = eventLabel.trim();
  if (!hasGuaranteed) return t;
  if (/\bprocessing\b/i.test(t) && !/\bwarehouse\b/i.test(t)) {
    return "Processing at Warehouse";
  }
  return t;
}

type SellerActionCenterProps = {
  item: OrderItemRow;
  orderId: string;
  onSync: () => void;
};

function SellerActionCenter({ item, orderId, onSync }: SellerActionCenterProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<LineItemStatus>(() => normalizeLineStatus(item.status));
  const [tracking, setTracking] = useState(() => (item.tracking_ref || "").trim());
  const [saving, setSaving] = useState(false);
  const [successFlash, setSuccessFlash] = useState<"forward" | "other" | null>(null);

  useEffect(() => {
    setStatus(normalizeLineStatus(item.status));
    setTracking((item.tracking_ref || "").trim());
  }, [item.id, item.status, item.tracking_ref]);

  useEffect(() => {
    if (!successFlash) return;
    const t = window.setTimeout(() => setSuccessFlash(null), 3200);
    return () => window.clearTimeout(t);
  }, [successFlash]);

  const showTracking = status === "shipped";

  const handleApply = async () => {
    if (!user?.id || !item.id) return;
    const next = status;
    if (next === "shipped" && !tracking.trim()) {
      toast.error("Enter a waybill or tracking ID before marking as shipped.");
      return;
    }

    const prev = normalizeLineStatus(item.status);
    const trackingUnchanged =
      (item.tracking_ref || "").trim() === tracking.trim();
    if (prev === next && (next !== "shipped" || trackingUnchanged)) {
      toast.message("No change", { description: "Pick a different status or update tracking." });
      return;
    }

    setSaving(true);
    try {
      const payload: { status: LineItemStatus; tracking_ref: string | null } = {
        status: next,
        tracking_ref: next === "shipped" ? tracking.trim() : null,
      };

      const { error: uErr } = await supabase
        .from("order_items")
        .update(payload)
        .eq("id", item.id)
        .eq("seller_id", user.id);

      if (uErr) throw uErr;

      const eventLabel = eventLabelForLineStatus(next, item.product_title || "Product");
      const metadata: Record<string, unknown> = {
        order_item_id: item.id,
        seller_id: user.id,
        line_status: next,
        seller_action: true,
      };
      if (next === "shipped") metadata.tracking_ref = tracking.trim();

      const { error: evErr } = await supabase.from("order_events").insert({
        order_id: orderId,
        event_label: eventLabel,
        metadata,
      });
      if (evErr) throw evErr;

      const forward = isForwardPhase(prev, next);
      setSuccessFlash(forward ? "forward" : "other");
      toast.success(forward ? "Moved to the next phase" : "Status updated", {
        className: forward ? "bg-emerald-50 text-emerald-950 border border-emerald-200/80" : undefined,
        description: forward ? "Buyer will see this on the order timeline." : undefined,
      });
      onSync();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const shellClass =
    successFlash === "forward"
      ? "rounded-xl border-2 border-emerald-400 bg-emerald-50/90 shadow-sm shadow-emerald-200/50 ring-1 ring-emerald-300/60"
      : successFlash === "other"
        ? "rounded-xl border border-emerald-200/80 bg-emerald-50/50"
        : "rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white";

  return (
    <div className={`mt-3 p-4 ${shellClass} transition-colors duration-300`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
          <Store className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-950">Seller Action Center</p>
          <p className="text-xs text-emerald-800/80">Update fulfillment for your line item</p>
        </div>
      </div>

      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor={`status-${item.id}`}>
        Update status
      </label>
      <select
        id={`status-${item.id}`}
        value={status}
        onChange={(e) => setStatus(e.target.value as LineItemStatus)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
      >
        {LINE_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {showTracking ? (
        <div className="mt-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor={`track-${item.id}`}>
            Waybill or tracking ID
          </label>
          <input
            id={`track-${item.id}`}
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="e.g. DHL 1234567890"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleApply()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle className="h-4 w-4" aria-hidden />}
        {saving ? "Saving…" : "Apply update"}
      </button>

      {successFlash === "forward" ? (
        <p className="mt-2 text-center text-xs font-medium text-emerald-800">
          Success — this order moved forward. Timeline updated for the buyer.
        </p>
      ) : null}
    </div>
  );
}

export default function OrderDetail() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [orderEvents, setOrderEvents] = useState<OrderEventRow[]>([]);
  const [sellers, setSellers] = useState<Map<string, SellerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuyerView, setIsBuyerView] = useState(true);

  const load = useCallback(async () => {
    if (!authUser?.id || !id?.trim()) {
      setOrder(null);
      setItems([]);
      setOrderEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: ord, error: oErr } = await supabase.from("orders").select("*").eq("id", id.trim()).maybeSingle();

      if (oErr) throw oErr;
      if (!ord) {
        setOrder(null);
        setItems([]);
        setOrderEvents([]);
        setError("Order not found.");
        return;
      }

      const buyerId = String((ord as { buyer_id?: string }).buyer_id ?? "");

      const { data: its, error: iErr } = await supabase.from("order_items").select("*").eq("order_id", id.trim());

      if (iErr) throw iErr;

      const itemList = (its ?? []) as OrderItemRow[];
      const isBuyer = buyerId === authUser.id;
      const hasSellerLine = itemList.some((it) => it.seller_id && String(it.seller_id) === authUser.id);

      if (!isBuyer && !hasSellerLine) {
        setOrder(null);
        setItems([]);
        setOrderEvents([]);
        setError("Order not found.");
        return;
      }

      setIsBuyerView(isBuyer);
      setOrder(ord as OrderRow);

      const { data: evRows, error: evErr } = await supabase
        .from("order_events")
        .select("id, order_id, event_label, created_at, metadata")
        .eq("order_id", id.trim())
        .order("created_at", { ascending: true });

      if (evErr) throw evErr;
      setOrderEvents((evRows ?? []) as OrderEventRow[]);

      setItems(itemList);

      const sellerIds = [...new Set(itemList.map((i) => i.seller_id).filter(Boolean))] as string[];
      if (sellerIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles_public")
          .select("id, full_name, avatar_url, gender")
          .in("id", sellerIds);

        if (!pErr && profs) {
          const m = new Map<string, SellerLite>();
          for (const p of profs as SellerLite[]) {
            if (p.id) m.set(p.id, p);
          }
          setSellers(m);
        } else {
          setSellers(new Map());
        }
      } else {
        setSellers(new Map());
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load order");
      setOrder(null);
      setItems([]);
      setOrderEvents([]);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, id]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const addr = useMemo(() => shippingLines(order?.shipping_address ?? null), [order?.shipping_address]);

  const hasGuaranteedItems = useMemo(
    () => items.some((it) => isWarehouseShippingFulfillment(it.fulfillment_type)),
    [items],
  );

  const timelineSteps = useMemo(() => {
    if (orderEvents.length > 0) {
      return orderEvents.map((ev) => ({
        key: ev.id,
        label: displayEventLabel(ev.event_label, hasGuaranteedItems),
        timeLabel: formatOrderEventTime(ev.created_at),
      }));
    }
    return [
      {
        key: "fallback-placed",
        label: "Order Placed",
        timeLabel: formatOrderEventTime(order?.created_at ?? null),
      },
    ];
  }, [orderEvents, order?.created_at, hasGuaranteedItems]);

  const paymentSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const u = Number(it.price_at_time) || 0;
      return sum + q * u;
    }, 0);
  }, [items]);

  const deliverySum = items.reduce((sum, it) => sum + (Number(it.delivery_fee_at_time) || 0), 0);
  const platformFee = order?.platform_fee != null ? Number(order.platform_fee) : 0;
  const total =
    order?.total_amount != null && Number.isFinite(Number(order.total_amount))
      ? Number(order.total_amount)
      : paymentSubtotal + deliverySum + platformFee;

  const statusLower = (order?.status || "").toLowerCase();
  const isDelivered = statusLower === "delivered" || statusLower === "completed";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12 text-center">
        <p className="text-gray-800 mb-4">{error || "Order not found."}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">
              {isBuyerView ? "Order Details" : "Fulfillment · Order"}
            </h1>
            <p className="text-sm text-gray-600 font-mono truncate">{order.id}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        <div
          className={`rounded-lg p-4 text-white ${
            isDelivered ? "bg-[#22c55e]" : "bg-slate-700"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="font-semibold capitalize">{(order.status || "Order").replace(/_/g, " ")}</h2>
              <p className="text-sm text-white/90">
                Placed{" "}
                {order.created_at
                  ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Items Ordered</h2>
          <div className="space-y-4">
            {items.map((item, idx) => {
              const sid = item.seller_id || "";
              const sp = sid ? sellers.get(sid) : undefined;
              const sName = sp?.full_name?.trim() || "Seller";
              const sAvatar = getAvatarUrl(sp?.avatar_url ?? null, sp?.gender ?? null, sName);
              const sPhone = sp?.phone?.trim() || "";
              const pid = item.product_id != null ? String(item.product_id) : null;
              const isMyLine = Boolean(authUser?.id && sid && sid === authUser.id);
              const lineStatus = normalizeLineStatus(item.status);

              return (
                <div key={item.id ? item.id : `${item.order_id}-${pid ?? idx}`}>
                  {pid ? (
                    <Link to={`/products/${pid}`} className="flex gap-3 mb-3">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product_image ? (
                          <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                          {item.product_title || "Product"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">Qty: {item.quantity ?? 1}</p>
                        <p className="text-xs text-gray-500 capitalize mb-0.5">Line status: {lineStatus}</p>
                        <p className="text-base font-semibold text-gray-900">
                          {formatPrice(Number(item.price_at_time) || 0)}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex gap-3 mb-3">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product_image ? (
                          <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                          {item.product_title || "Product"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">Qty: {item.quantity ?? 1}</p>
                        <p className="text-xs text-gray-500 capitalize mb-0.5">Line status: {lineStatus}</p>
                        <p className="text-base font-semibold text-gray-900">
                          {formatPrice(Number(item.price_at_time) || 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {sid ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <img src={sAvatar} alt="" className="w-10 h-10 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{sName}</p>
                        <p className="text-xs text-gray-600">Seller</p>
                      </div>
                      <Link to={`/messages/u/${sid}`} className="p-2 bg-[#22c55e] rounded-lg shrink-0">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </Link>
                      {sPhone ? (
                        <a href={`tel:${sPhone.replace(/\s/g, "")}`} className="p-2 border border-gray-300 rounded-lg shrink-0">
                          <Phone className="w-4 h-4 text-gray-600" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {isMyLine && item.id ? (
                    <SellerActionCenter item={item} orderId={order.id} onSync={() => void load()} />
                  ) : null}

                  {isBuyerView && isDelivered && pid ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <Link
                        to={`/products/${encodeURIComponent(pid)}/write-review`}
                        className="w-full py-2 border border-[#22c55e] bg-[#22c55e] text-white rounded-lg font-medium text-sm text-center flex items-center justify-center gap-2 hover:bg-[#15803d]"
                      >
                        <Star className="w-4 h-4" />
                        Review this product
                      </Link>
                      <Link
                        to={`/reviews/${order.id}?productId=${encodeURIComponent(pid)}`}
                        className="w-full py-2 border border-gray-300 text-gray-800 rounded-lg font-medium text-sm text-center flex items-center justify-center gap-2 hover:bg-gray-50"
                      >
                        <Star className="w-4 h-4" />
                        Review seller
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Delivery Address</h2>
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-800 mb-1">{addr.fullName}</p>
              <p>{addr.phone}</p>
              <p className="mt-2">{addr.address}</p>
              <p>
                {addr.lga}, {addr.state}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-[#16a34a] shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">Order Timeline</h2>
                <p className="text-xs text-gray-500">Shipment activity and milestones</p>
              </div>
            </div>
          </div>
          <ol className="relative m-0 p-0 list-none pl-1" aria-label="Order timeline">
            {timelineSteps.map((step, index) => {
              const isLast = index === timelineSteps.length - 1;
              return (
                <li key={step.key} className="relative flex gap-0">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <span
                      className="z-[1] mt-0.5 h-3 w-3 rounded-full bg-[#22c55e] ring-4 ring-[#22c55e]/15"
                      title="Completed"
                      aria-hidden
                    />
                    {!isLast ? <span className="w-px flex-1 min-h-[2.75rem] bg-gray-200" aria-hidden /> : null}
                  </div>
                  <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{step.label}</p>
                    <p className="mt-1 text-xs font-medium tabular-nums text-gray-500">{step.timeLabel}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {isBuyerView ? (
          <div className="bg-white rounded-lg p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Payment Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium text-gray-800">{paymentMethodLabel(order.payment_method)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Reference</span>
                <span className="font-medium text-gray-800 truncate max-w-[60%] font-mono text-xs">
                  {order.payment_reference || "—"}
                </span>
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-800">{formatPrice(paymentSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium text-gray-800">
                  {formatPrice(order.delivery_fee != null ? Number(order.delivery_fee) : deliverySum)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="font-medium text-gray-800">{formatPrice(platformFee)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-800">Total Paid</span>
                <span className="text-xl font-bold text-[#22c55e]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-gray-500 px-2">
            Payment details are visible to the buyer. You can manage fulfillment and timeline updates above.
          </p>
        )}

        {isBuyerView && isDelivered ? (
          <div className="flex gap-3">
            <Link to="/products" className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-semibold text-center">
              Shop again
            </Link>
            <Link to="/messages" className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold text-center">
              Messages
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
