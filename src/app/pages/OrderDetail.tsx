import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useState } from "react";
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
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../hooks/useCurrency";
import { getAvatarUrl } from "../utils/getAvatar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { isWarehouseShippingFulfillment } from "../utils/fulfillment";
import DeliveryMapBottomPanel from "../components/maps/DeliveryMapBottomPanel";
import { initialOrderState, orderReducer } from "../state/OrderReducer";
import { OrderState, OrderAction, OrderStatus as OrderStateType, OrderUiState, OrderActionType } from "../state/OrderState";
import { OrderActionBar } from "../components/order/OrderActionBar";
import { getOrderActions } from "../state/OrderActionEngine";

const DeliveryTrackingMap = lazy(() => import("../components/maps/DeliveryTrackingMap"));


type LineItemStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | number | null;
  seller_id: string | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  price_at_time?: number | null;
  /** Present when DB uses base migration without `price_at_time` column */
  unit_price?: number | null;
  delivery_fee_at_time: number | null;
  fulfillment_type?: string | null;
  status?: string | null;
  tracking_ref?: string | null;
  is_reviewed?: boolean | null;
};

function orderItemUnitPrice(it: OrderItemRow): number {
  const v = it.price_at_time ?? it.unit_price;
  return Number(v) || 0;
}

type OrderEventRow = {
  id: string;
  event_label: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type OrderUiState =
  | "searching_rider"
  | "rider_assigned"
  | "rider_picking_up"
  | "rider_on_the_way"
  | "arriving"
  | "delivered"
  | "cancelled"
  | "unknown";

type OrderMeta = {
  paymentMethod: string | null;
  paymentReference: string | null;
  deliveryFee: number | null;
  totalAmount: number | null;
};

function safeText(value: unknown, fallback = "—"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function orderUiStateFromOrderStatus(status: OrderStateType): OrderUiState {
  switch (status) {
    case "PENDING":
      return "searching_rider";
    case "ACCEPTED":
      return "rider_assigned";
    case "EN_ROUTE_TO_PICKUP":
      return "rider_picking_up";
    case "AT_PICKUP":
    case "EN_ROUTE_TO_DROPOFF":
      return "rider_on_the_way";
    case "AT_DROPOFF":
      return "arriving";
    case "DELIVERED":
    case "COMPLETED":
      return "delivered";
    case "CANCELLED_BY_BUYER":
    case "CANCELLED_BY_RIDER":
      return "cancelled";
    default:
      return "unknown";
  }
}

function orderUiStatusLabel(state: OrderUiState): string {
  switch (state) {
    case "searching_rider":
      return "Finding rider";
    case "rider_assigned":
      return "Rider assigned";
    case "rider_picking_up":
      return "Rider going to pickup";
    case "rider_on_the_way":
      return "On the way";
    case "arriving":
      return "Arriving";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return "—";
  }
}





function parseLatLngFromAddress(addr: Record<string, unknown> | null | undefined): { lat: number; lng: number } | null {
  if (!addr || typeof addr !== "object") return null;
  const latRaw = addr.latitude ?? addr.lat;
  const lngRaw = addr.longitude ?? addr.lng ?? addr.lon;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Default hub marker when order has guaranteed / hub fulfillment (align with ops). */
const DEFAULT_HUB_LAT = 6.5244;
const DEFAULT_HUB_LNG = 3.3792;

function MapSkeleton() {
  return (
    <div className="h-72 w-full animate-pulse rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200" />
  );
}

type SellerLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
  phone: string | null;
};

const LINE_STATUS_OPTIONS: { value: LineItemStatus; label: string }[] = [
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

function eventLabelForLineStatus(status: LineItemStatus): string {
  const pretty = status.charAt(0).toUpperCase() + status.slice(1);
  return `Seller has marked item as ${pretty}`;
}

function shippingLines(addr: Record<string, unknown> | null): { fullName: string; phone: string; address: string; state: string; lga: string } {
  if (!addr || typeof addr !== "object") {
    return { fullName: "—", phone: "—", address: "—", state: "—", lga: "—" };
  }
  return {
    fullName: safeText(addr.fullName ?? addr.full_name),
    phone: safeText(addr.phone),
    address: safeText(addr.address),
    state: safeText(addr.state),
    lga: safeText(addr.lga),
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

      const eventLabel = eventLabelForLineStatus(next);
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
      toast.success(forward ? "Order marked as shipped!" : "Order status updated!", {
        icon: <Truck className="h-4 w-4 text-emerald-600" />,
        className: "bg-emerald-50 text-emerald-950 border border-emerald-200/80",
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
          <p className="text-sm font-semibold text-emerald-950">Status Update</p>
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

  const [orderState, dispatch] = useReducer(orderReducer, initialOrderState);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [orderEvents, setOrderEvents] = useState<OrderEventRow[]>([]);
  const [sellers, setSellers] = useState<Map<string, SellerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuyerView, setIsBuyerView] = useState(true);
  const [orderMeta, setOrderMeta] = useState<OrderMeta>({
    paymentMethod: null,
    paymentReference: null,
    deliveryFee: null,
    totalAmount: null,
  });
  // Review-related states are kept separate for now, as they are not part of the core order state machine
  const [reviewItem, setReviewItem] = useState<OrderItemRow | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const load = useCallback(async () => {
    const userId = authUser?.id?.trim();
    const orderId = id?.trim();
    if (!userId || !orderId) {
      dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
      setItems([]); // Items are separate for now
      setOrderEvents([]); // Events are separate for now
      setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: ord, error: oErr } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      console.log("DEBUG: Supabase Error", oErr);

      if (oErr) {
        console.error("[OrderDetail] orders select error", oErr);
        throw oErr;
      }
      if (!ord) {
        dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
        setItems([]);
        setOrderEvents([]);
        setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
        setError("Order not found.");
        return;
      }

      const buyerId = String((ord as { buyer_id?: string }).buyer_id ?? "");

      const { data: its, error: iErr } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      console.log("DEBUG: Supabase Error", iErr);

      if (iErr) {
        console.error("[OrderDetail] order_items select error", iErr);
        throw iErr;
      }

      const itemList = (its ?? []) as OrderItemRow[];
      const isBuyer = buyerId === userId;
      const hasSellerLine = itemList.some((it) => it.seller_id && String(it.seller_id) === userId);

      if (!isBuyer && !hasSellerLine) {
        dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
        setItems([]);
        setOrderEvents([]);
        setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
        setError("Order not found.");
        return;
      }

      setIsBuyerView(isBuyer);
      setOrderMeta({
        paymentMethod: ord.payment_method ?? null,
        paymentReference: ord.payment_reference ?? null,
        deliveryFee: Number.isFinite(Number(ord.delivery_fee)) ? Number(ord.delivery_fee) : null,
        totalAmount: Number.isFinite(Number(ord.total_amount ?? ord.total_price ?? ord.amount))
          ? Number(ord.total_amount ?? ord.total_price ?? ord.amount)
          : null,
      });
      // setOrder(ord as OrderRow); // Removed, now handled by reducer

      dispatch({
        type: "SET_ORDER_DETAILS" as any,
        payload: {
          orderId: ord.id,
          status: ord.status as OrderStateType,
          pickupLocation: parseLatLngFromAddress(ord.shipping_address) ? { ...parseLatLngFromAddress(ord.shipping_address), address: shippingLines(ord.shipping_address).address } : initialOrderState.pickupLocation,
          dropoffLocation: parseLatLngFromAddress(ord.shipping_address) ? { ...parseLatLngFromAddress(ord.shipping_address), address: shippingLines(ord.shipping_address).address } : initialOrderState.dropoffLocation,
          // Add other initial order details that directly map to OrderState
        },
      });

      const { data: dr, error: drErr } = await supabase
        .from("delivery_requests")
        .select("id, order_id, status, assigned_rider_id, delivery_pin, delivered_at, created_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (drErr) {
        console.warn("[OrderDetail] delivery_requests select", drErr);
        dispatch({ type: "UPDATE_RIDER_INFO", riderInfo: null });
      } else {
        if (dr?.assigned_rider_id) {
          const { data: riderProfile, error: rErr } = await supabase
            .from("profiles_public")
            .select("id, full_name, avatar_url, gender, phone")
            .eq("id", dr.assigned_rider_id)
            .maybeSingle();
          if (!rErr && riderProfile) {
            dispatch({
              type: "UPDATE_RIDER_INFO",
              riderInfo: {
                id: riderProfile.id,
                name: riderProfile.full_name || "Rider",
                vehicle: "Bike", // Placeholder, needs actual vehicle type from data
                plateNumber: "ABC-123", // Placeholder
                phone: riderProfile.phone || "",
                photoUrl: getAvatarUrl(riderProfile.avatar_url, riderProfile.gender, riderProfile.full_name || "Rider"),
              },
            });
          } else {
            console.warn("[OrderDetail] rider profile select", rErr);
            dispatch({ type: "UPDATE_RIDER_INFO", riderInfo: null });
          }
        } else {
          dispatch({ type: "UPDATE_RIDER_INFO", riderInfo: null });
        }
        dispatch({ type: "UPDATE_ORDER_STATUS", status: (dr?.status as OrderStateType) || "PENDING" });
        // Dispatch action for estimated arrival time if available
        // dispatch({ type: "UPDATE_ESTIMATED_ARRIVAL_TIME", time: dr?.delivered_at ? formatOrderEventTime(dr.delivered_at) : null });
      }

      // Remove fetching delivery_jobs as its data will be managed by OrderState
      // const { data: dj, error: djErr } = await supabase.from("delivery_jobs").select("*").eq("order_id", orderId).maybeSingle();
      // if (djErr) {
      //   console.warn("[OrderDetail] delivery_jobs select", djErr);
      // } else if (dj) {
      //   const job = dj as DeliveryJobRow;
      //   const { data: deRows, error: deErr } = await supabase
      //     .from("delivery_events")
      //     .select("id, event_type, created_at")
      //     .eq("job_id", job.id)
      //     .order("created_at", { ascending: true });
      //   if (deErr) {
      //     console.warn("[OrderDetail] delivery_events select", deErr);
      //   } else {
      //     setDeliveryEvents((deRows ?? []) as DeliveryEventRow[]);
      //   }
      // }


      const { data: evRows, error: evErr } = await supabase
        .from("order_events")
        .select("id, order_id, event_label, created_at, metadata")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      console.log("DEBUG: Supabase Error", evErr);

      if (evErr) {
        console.error(
          "[OrderDetail] order_events select error (expect: id, order_id, event_label, created_at, metadata)",
          evErr,
        );
        throw evErr;
      }
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
      console.error("[OrderDetail] load failed", e);
      setError(e instanceof Error ? e.message : "Could not load order");
      dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
      setItems([]);
      setOrderEvents([]);
      setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, id]);

  useEffect(() => {
    if (!orderState.orderId || !isBuyerView) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
    };
    void poll();
    const t = window.setInterval(() => void poll(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [orderState.orderId, orderState.status, isBuyerView, dispatch]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const addr = useMemo(() => shippingLines(orderState.pickupLocation.address ? { address: orderState.pickupLocation.address } : null), [orderState.pickupLocation.address]); // Assuming pickupLocation.address is a string

  const dropCoords = useMemo(
    () => orderState.dropoffLocation,
    [orderState.dropoffLocation],
  );

  const deliveryRequestTimeline = useMemo(() => {
    // Simplified timeline based on OrderState status
    const st = orderState.status;
    const steps: { key: string; label: string; done: boolean }[] = [
      { key: "pending", label: "Delivery request created", done: true },
      { key: "assigned", label: "Rider assigned", done: ["ACCEPTED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF", "AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
      { key: "picked_up", label: "Picked up — on the way", done: ["AT_PICKUP", "EN_ROUTE_TO_DROPOFF", "AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
      { key: "delivered", label: "Delivered", done: ["AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
    ];
    if (st.startsWith("CANCELLED")) {
      return [{ key: "cancelled", label: "Delivery cancelled", done: true }];
    }
    return steps;
  }, [orderState.status]);
  const liveRiderLocation = useMemo(
    () =>
      orderState.currentRiderLocation != null
        ? {
            lat: orderState.currentRiderLocation.lat,
            lng: orderState.currentRiderLocation.lng,
            bearing: orderState.currentRiderLocation.bearing,
            lastSeenAt: new Date().toISOString(), // Placeholder, needs actual timestamp from tracking data
          }
        : null,
    [orderState.currentRiderLocation],
  );
  const deliveryPanelStatus = useMemo<"rider_on_the_way" | "picked_up_item" | "arriving_soon">(() => {
    // Map OrderState status to delivery panel status
    switch (orderState.status) {
      case "EN_ROUTE_TO_PICKUP":
      case "AT_PICKUP":
        return "rider_on_the_way";
      case "EN_ROUTE_TO_DROPOFF":
        return "picked_up_item";
      case "AT_DROPOFF":
      case "DELIVERED":
      case "COMPLETED":
        return "arriving_soon";
      default:
        return "rider_on_the_way";
    }
  }, [orderState.status]);
  const deliveryPanelRiderName = useMemo(() => {
    if (!orderState.riderInfo) return "Rider";
    return `Rider ${orderState.riderInfo.name}`; // Or slice(0,8) if needed
  }, [orderState.riderInfo]);

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
        timeLabel: formatOrderEventTime(orderState.orderId ? new Date().toISOString() : null), // Placeholder, use orderState.created_at once available
      },
    ];
  }, [orderEvents, orderState.orderId, hasGuaranteedItems]);

  const paymentSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const u = orderItemUnitPrice(it);
      return sum + q * u;
    }, 0);
  }, [items]);

  const deliverySum = items.reduce((sum, it) => sum + (Number(it.delivery_fee_at_time) || 0), 0);
  const platformFee = 0; // Placeholder, fetch from orderState when available
  const dbTotal = orderMeta.totalAmount ?? 0;
  const total = dbTotal > 0 ? dbTotal : paymentSubtotal + deliverySum + platformFee;
  const orderUiState = useMemo(() => orderUiStateFromOrderStatus(orderState.status), [orderState.status]);
  const orderStatusLabel = useMemo(() => orderUiStatusLabel(orderUiState), [orderUiState]);

  const hasReviewableItems = useMemo(() => items.some(item => !item.is_reviewed), [items]);
  const resolvedActions = useMemo(() => getOrderActions(orderUiState, isBuyerView, orderState.riderInfo, orderState.orderId, hasReviewableItems), [
    orderUiState,
    isBuyerView,
    orderState.riderInfo,
    orderState.orderId,
    hasReviewableItems,
  ]);

  const statusLower = orderState.status.toLowerCase();
  const isDelivered = ["delivered", "completed", "at_dropoff"].includes(statusLower);

  // Old submitReview logic is now part of handleOrderAction
  // const submitReview = useCallback(async () => {
  //   ...
  // }, [authUser?.id, reviewItem, reviewRating, reviewText, reviewAnonymous]);

  const openReviewModal = (item: OrderItemRow) => {
    dispatch({ type: "INITIATE_REVIEW", itemId: item.id, productId: String(item.product_id), orderId: orderState.orderId });
    setReviewItem(item);
    setReviewRating(0);
    setReviewText("");
    setReviewAnonymous(false);
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    dispatch({ type: "CANCEL_REVIEW" });
    setReviewItem(null);
  };

  const handleOrderAction = useCallback(async (actionType: OrderActionType, payload?: any) => {
    if (!authUser?.id || !orderState.orderId) {
      toast.error("User not authenticated or order not loaded.");
      return;
    }

    setReviewSubmitting(true);
    try {
      switch (actionType) {
        case "CANCEL_ORDER":
          // TODO: Implement actual cancellation API call
          toast.info("Order cancellation initiated (mock).", { description: "This will be a real cancellation soon." });
          dispatch({ type: "UPDATE_ORDER_STATUS", status: "CANCELLED_BY_BUYER" });
          break;
        case "MESSAGE_RIDER":
          navigate(`/messages/u/${payload?.riderId}`);
          break;
        case "CALL_RIDER":
          if (payload?.riderPhone) {
            window.location.href = `tel:${payload.riderPhone.replace(/\s/g, "")}`;
          } else {
            toast.error("Rider phone number not available.");
          }
          break;
        case "SHOP_AGAIN":
          navigate("/products");
          break;
        case "GET_HELP":
          navigate("/support");
          break;
        case "RATE_ORDER":
          // This action will trigger the review modal for all reviewable items.
          // For now, we'll just open the review modal if there's an item to review.
          const itemToReview = items.find(item => !item.is_reviewed);
          if (itemToReview) {
            openReviewModal(itemToReview); 
          } else {
            toast.info("No items left to review.");
          }
          break;
        case "GO_HOME":
          navigate("/");
          break;
        case "GO_BACK":
          navigate(payload?.steps ?? -1);
          break;
        case "REFRESH":
          window.location.reload();
          break;
        case "TRACK_STATUS":
          // No-op for now, as tracking is on the same page. Could implement scroll to map.
          toast.info("Tracking status is updated live on this page.");
          break;
        case "SUBMIT_RATING":
          if (!reviewItem?.id || !reviewItem.product_id || !orderState.orderId) {
            toast.error("Review item details missing.");
            return;
          }
          if (reviewRating < 1 || reviewRating > 5) {
            toast.error("Please select a star rating.");
            return;
          }

          const { error: reviewErr } = await supabase.from("reviews").insert({
            product_id: reviewItem.product_id,
            buyer_id: authUser.id,
            order_item_id: reviewItem.id,
            order_id: orderState.orderId,
            rating: reviewRating,
            feedback: reviewText.trim() || null,
            is_anonymous: reviewAnonymous,
          });
          if (reviewErr) throw reviewErr;

          const { error: updateErr } = await supabase
            .from("order_items")
            .update({ is_reviewed: true })
            .eq("id", reviewItem.id)
            .eq("order_id", orderState.orderId);
          if (updateErr) throw updateErr;

          setItems((prev) =>
            prev.map((it) => (it.id === reviewItem.id ? { ...it, is_reviewed: true } : it)),
          );
          toast.success("Review submitted. Thank you!", {
            icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
            className: "bg-emerald-50 text-emerald-950 border border-emerald-200/80",
          });
          setReviewItem(null);
          break;
        case "CANCEL_REVIEW_RATING":
          setReviewItem(null);
          break;
        // No default case to ensure all actions are explicitly handled
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `Failed to perform action: ${actionType}`);
    } finally {
      setReviewSubmitting(false);
    }
  }, [authUser?.id, orderState.orderId, reviewItem, reviewRating, reviewText, reviewAnonymous, navigate, items, dispatch]);


  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (error || !orderState.orderId) {
    const goBackAction = resolvedActions.passive?.find(a => a.actionType === "GO_BACK");
    const getHelpAction = resolvedActions.secondary.find(a => a.actionType === "GET_HELP");

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12 text-center">
        <p className="text-gray-800 mb-4">{error || "Order not found."}</p>
        {goBackAction ? (
          <button
            type="button"
            onClick={() => handleOrderAction(goBackAction.actionType, goBackAction.payload)}
            className="px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-medium"
          >
            {goBackAction.label}
          </button>
        ) : null}
        {getHelpAction ? (
          <button
            type="button"
            onClick={() => handleOrderAction(getHelpAction.actionType, getHelpAction.payload)}
            className="ml-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
          >
            {getHelpAction.label}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          {resolvedActions.passive?.find(a => a.actionType === "GO_BACK") ? (
            <button type="button" onClick={() => handleOrderAction("GO_BACK")} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          ) : null}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">
              {isBuyerView ? "Order Details" : "Fulfillment · Order"}
            </h1>
            <p className="text-sm text-gray-600 font-mono truncate">{orderState.orderId}</p>
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
              <h2 className="font-semibold capitalize">{orderState.status.replace(/_/g, " ")}</h2>
              <p className="text-sm text-white/90">
                Placed{" "}
                {new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} // Placeholder, use orderState.createdAt once available
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
                          {formatPrice(orderItemUnitPrice(item))}
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
                          {formatPrice(orderItemUnitPrice(item))}
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
                      {/* <Link to={`/messages/u/${sid}`} className="p-2 bg-[#22c55e] rounded-lg shrink-0">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </Link>
                      {sPhone ? (
                        <a href={`tel:${sPhone.replace(/\s/g, "")}`} className="p-2 border border-gray-300 rounded-lg shrink-0">
                          <Phone className="w-4 h-4 text-gray-600" />
                        </a>
                      ) : null} */}
                    </div>
                  ) : null}

                  {isMyLine && item.id && !isBuyerView ? (
                    <SellerActionCenter item={item} orderId={orderState.orderId} onSync={() => void load()} />
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

        {orderState.orderId ? ( // Conditional render based on orderState existence
          <div className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Truck className="h-5 w-5 text-sky-700 shrink-0" aria-hidden />
              <h2 className="font-semibold text-sky-950">Rider delivery</h2>
            </div>
            <p className="text-sm text-gray-800">
              Status: <span className="font-medium">{safeText(orderStatusLabel)}</span>
              {orderState.estimatedArrivalTime ? (
                <span className="text-xs text-gray-500"> · Arriving {orderState.estimatedArrivalTime}</span> // Use estimatedArrivalTime
              ) : null}
            </p>
            <ol className="mt-3 space-y-2 border-t border-sky-100 pt-3 text-sm text-gray-700">
              {deliveryRequestTimeline.map((step) => (
                <li key={step.key} className={`flex items-center gap-2 ${step.done ? "text-gray-900" : "text-gray-400"}`}>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${step.done ? "bg-sky-600" : "bg-gray-300"}`}
                    aria-hidden
                  />
                  {step.label}
                </li>
              ))}
            </ol>
            {isBuyerView &&
            ["EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF"].includes(orderState.status) &&
            orderState.dropoffLocation.address ? ( // Use dropoffLocation.address
              <div className="mt-3 rounded-lg border border-sky-300/60 bg-white/90 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">Delivery Address</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-[0.05em] text-sky-950">{orderState.dropoffLocation.address}</p>
              </div>
            ) : null}
            {isBuyerView && ["ACCEPTED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF"].includes(orderState.status) ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-gray-600">Live map (rider position updates about every 10s)</p>
                <div className="relative">
                  <Suspense fallback={<MapSkeleton />}>
                    <DeliveryTrackingMap
                      riderLocation={liveRiderLocation}
                      pickupLocation={hasGuaranteedItems ? { lat: DEFAULT_HUB_LAT, lng: DEFAULT_HUB_LNG } : orderState.pickupLocation}
                      dropoffLocation={orderState.dropoffLocation}
                    />
                  </Suspense>
                  <DeliveryMapBottomPanel
                    visible={Boolean(liveRiderLocation)}
                    riderName={deliveryPanelRiderName}
                    vehicleType="bike"
                    etaText={orderState.estimatedArrivalTime ? `Arriving ${orderState.estimatedArrivalTime}` : "—"}
                    status={deliveryPanelStatus}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}


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
                <span className="font-medium text-gray-800">{paymentMethodLabel(orderMeta.paymentMethod)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Reference</span>
                <span className="font-medium text-gray-800 truncate max-w-[60%] font-mono text-xs">
                  {safeText(orderMeta.paymentReference)}
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
                  {formatPrice(orderMeta.deliveryFee != null ? orderMeta.deliveryFee : deliverySum)}
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

        <OrderActionBar 
          orderUiState={orderUiState} 
          isBuyerView={isBuyerView} 
          riderInfo={orderState.riderInfo} 
          orderId={orderState.orderId} 
          hasReviewableItems={hasReviewableItems} 
          onAction={handleOrderAction} 
        />

        {resolvedActions.secondary.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {resolvedActions.secondary.map((action) => (
              <button
                key={action.actionType}
                type="button"
                onClick={() => handleOrderAction(action.actionType, action.payload)}
                disabled={action.disabled}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {reviewItem ? (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Write a verified review</h3>
            <p className="mt-1 text-sm text-gray-600">
              {reviewItem.product_title || "Product"} · Delivered order feedback
            </p>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Rating</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const n = i + 1;
                  const active = n <= reviewRating;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)} // Still local state for star selection
                      className="rounded p-1"
                      aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                    >
                      <Star className={`h-6 w-6 ${active ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">Product Feedback</label>
              <textarea
                rows={4}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this product..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={reviewAnonymous}
                onChange={(e) => setReviewAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#22c55e] focus:ring-[#22c55e]"
              />
              Post Anonymously
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleOrderAction("CANCEL_REVIEW_RATING")}
                disabled={reviewSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleOrderAction("SUBMIT_RATING")}
                disabled={reviewSubmitting}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
