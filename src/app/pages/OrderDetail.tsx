import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  Star,
  Package,
  Store,
  Loader2,
  Truck,
} from "@/app/icons/emojiLucide";
import { toast } from "sonner";
import { useCurrency } from "../hooks/useCurrency";
import { getAvatarUrl } from "../utils/getAvatar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { deriveMarketModeFromLineItems, isWarehouseShippingFulfillment } from "../utils/fulfillment";
import { initialOrderState, orderReducer } from "../state/OrderReducer";
import { OrderStatus as OrderStateType, OrderUiState, OrderActionType, OrderTrackingStage } from "../state/OrderState";
import { OrderActionBar } from "../components/order/OrderActionBar";
import { OrderStatusPanel, trackingStageHeadline } from "../components/order/OrderStatusPanel";
import { OrderFooterActions } from "../components/order/OrderFooterActions";
import { orderTrackBtnPrimary, orderTrackBtnSecondaryInline } from "../components/order/orderTrackingButtonClasses";
import { cn } from "../components/ui/utils";
import { getOrderActions } from "../state/OrderActionEngine";
import { deliveryJobStatusLabel, resolveCourierUiStatusFromOrderAndJob } from "../utils/deliveryJobs";
import { formatBuyerCancelOrderError } from "../utils/buyerCancelOrderError";

/** Buyer live GPS polling while tracking stack is visible (no realtime on rider_presence). */
const RIDER_PRESENCE_POLL_MS = 15_000;

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

type OrderMeta = {
  paymentMethod: string | null;
  paymentReference: string | null;
  deliveryFee: number | null;
  totalAmount: number | null;
};

type DeliveryJobRow = {
  id: string;
  order_id: string;
  status: string;
  assigned_rider_id: string | null;
  buyer_pin: string;
  quoted_fee: number | null;
  pickup_summary: Record<string, unknown> | null;
  created_at: string;
};

type DeliveryAssignmentRow = {
  id: string;
  job_id: string;
  rider_user_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
};

type DeliveryEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
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

function baseTrackingStageFromOrderStatus(status: OrderStateType): OrderTrackingStage {
  switch (status) {
    case "PENDING":
      return "searching";
    case "ACCEPTED":
    case "EN_ROUTE_TO_PICKUP":
      return "assigned";
    case "AT_PICKUP":
    case "EN_ROUTE_TO_DROPOFF":
      return "in_transit";
    case "AT_DROPOFF":
    case "DELIVERED":
    case "COMPLETED":
      return "delivered";
    default:
      if (String(status).startsWith("CANCELLED")) return "searching";
      return "searching";
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
  /** True when the last load failed with an exception (network / server) — show Retry. */
  const [loadRetryable, setLoadRetryable] = useState(false);
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
  const [deliveryJobEvents, setDeliveryJobEvents] = useState<DeliveryEventRow[]>([]);
  const [deliveryAssignments, setDeliveryAssignments] = useState<DeliveryAssignmentRow[]>([]);
  const [greenhubJobStatus, setGreenhubJobStatus] = useState<string | null>(null);
  /** `delivery_jobs.assigned_rider_id` (auth user id), when set. */
  const [deliveryAssignedRiderId, setDeliveryAssignedRiderId] = useState<string | null>(null);
  const [buyerDeliveryPin, setBuyerDeliveryPin] = useState<string | null>(null);
  /** Lowercase `orders.status` from DB (for POD seller actions). */
  const [orderDbStatus, setOrderDbStatus] = useState<string | null>(null);
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);

  const load = useCallback(async () => {
    const userId = authUser?.id?.trim();
    const orderId = id?.trim();
    if (!userId || !orderId) {
      dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
      setItems([]); // Items are separate for now
      setOrderEvents([]); // Events are separate for now
      setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
      setDeliveryJobEvents([]);
      setDeliveryAssignments([]);
      setGreenhubJobStatus(null);
      setDeliveryAssignedRiderId(null);
      setBuyerDeliveryPin(null);
      setOrderDbStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLoadRetryable(false);
    try {
      const { data: ord, error: oErr } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

      if (oErr) {
        console.error("[OrderDetail] orders select error", oErr);
        throw oErr;
      }
      if (!ord) {
        dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
        setItems([]);
        setOrderEvents([]);
        setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
        setDeliveryJobEvents([]);
        setDeliveryAssignments([]);
        setGreenhubJobStatus(null);
        setDeliveryAssignedRiderId(null);
        setBuyerDeliveryPin(null);
        setOrderDbStatus(null);
        setError("Order not found.");
        return;
      }

      const buyerId = String((ord as { buyer_id?: string }).buyer_id ?? "");

      const { data: its, error: iErr } = await supabase.from("order_items").select("*").eq("order_id", orderId);

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
        setDeliveryJobEvents([]);
        setDeliveryAssignments([]);
        setGreenhubJobStatus(null);
        setDeliveryAssignedRiderId(null);
        setBuyerDeliveryPin(null);
        setOrderDbStatus(null);
        setError("Order not found.");
        return;
      }

      const ordRec = ord as Record<string, unknown>;
      setIsBuyerView(isBuyer);
      setOrderDbStatus(String((ordRec.status as string | undefined) ?? "").toLowerCase());
      setOrderMeta({
        paymentMethod: (typeof ordRec.payment_method === "string" ? ordRec.payment_method : null) ?? null,
        paymentReference: (typeof ordRec.payment_reference === "string" ? ordRec.payment_reference : null) ?? null,
        deliveryFee: Number.isFinite(Number(ordRec.delivery_fee)) ? Number(ordRec.delivery_fee) : null,
        totalAmount: Number.isFinite(Number(ordRec.total_amount ?? ordRec.total_price ?? ordRec.amount))
          ? Number(ordRec.total_amount ?? ordRec.total_price ?? ordRec.amount)
          : null,
      });

      const { data: djRaw, error: djErr } = await supabase
        .from("delivery_jobs")
        .select("id, order_id, status, assigned_rider_id, buyer_pin, quoted_fee, pickup_summary, created_at")
        .eq("order_id", orderId)
        .maybeSingle();

      if (djErr) {
        console.warn("[OrderDetail] delivery_jobs select", djErr);
      }

      const dj = (djRaw as DeliveryJobRow | null) ?? null;
      let assignmentRows: DeliveryAssignmentRow[] = [];
      let eventRows: DeliveryEventRow[] = [];

      if (dj?.id) {
        const [aRes, eRes] = await Promise.all([
          supabase
            .from("delivery_assignments")
            .select("id, job_id, rider_user_id, status, created_at, responded_at")
            .eq("job_id", dj.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("delivery_events")
            .select("id, job_id, event_type, payload, created_at")
            .eq("job_id", dj.id)
            .order("created_at", { ascending: true }),
        ]);
        if (aRes.error) console.warn("[OrderDetail] delivery_assignments select", aRes.error);
        else assignmentRows = (aRes.data as DeliveryAssignmentRow[]) ?? [];
        if (eRes.error) console.warn("[OrderDetail] delivery_events select", eRes.error);
        else eventRows = (eRes.data as DeliveryEventRow[]) ?? [];
      }

      setDeliveryAssignments(assignmentRows);
      setDeliveryJobEvents(eventRows);
      setGreenhubJobStatus(dj?.status ?? null);
      setDeliveryAssignedRiderId(dj?.assigned_rider_id?.trim() ? String(dj.assigned_rider_id).trim() : null);
      setBuyerDeliveryPin(isBuyer && dj?.buyer_pin ? String(dj.buyer_pin).trim() || null : null);

      const resolvedStatus = resolveCourierUiStatusFromOrderAndJob(
        String((ord as { status?: string }).status ?? ""),
        dj,
      );

      const marketMode = deriveMarketModeFromLineItems(itemList);

      const shipAddr = ordRec.shipping_address as Record<string, unknown> | null | undefined;
      const parsedShip = parseLatLngFromAddress(shipAddr);
      const shipLines = shippingLines(shipAddr ?? null);
      const pickupDrop = parsedShip
        ? { ...parsedShip, address: shipLines.address }
        : initialOrderState.pickupLocation;

      dispatch({
        type: "SET_ORDER_DETAILS" as any,
        payload: {
          orderId: String(ordRec.id ?? orderId),
          status: resolvedStatus,
          marketMode,
          pickupLocation: pickupDrop,
          dropoffLocation: pickupDrop,
        },
      });

      if (dj?.assigned_rider_id) {
        const riderId = dj.assigned_rider_id;
        const [{ data: riderProfile, error: rErr }, { data: ghRider, error: ghErr }] = await Promise.all([
          supabase.from("profiles_public").select("id, full_name, avatar_url, gender, phone").eq("id", riderId).maybeSingle(),
          supabase.from("greenhub_riders").select("user_id, vehicle_type").eq("user_id", riderId).maybeSingle(),
        ]);
        if (!rErr && riderProfile) {
          type RiderPublicProfile = {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
            gender: string | null;
            phone: string | null;
          };
          const p = riderProfile as RiderPublicProfile;
          const vehicle = !ghErr && ghRider?.vehicle_type ? String(ghRider.vehicle_type) : "Bike";
          dispatch({
            type: "UPDATE_RIDER_INFO",
            riderInfo: {
              id: p.id,
              name: p.full_name || "Rider",
              vehicle: vehicle,
              plateNumber: "—",
              phone: p.phone || "",
              photoUrl: getAvatarUrl(p.avatar_url, p.gender, p.full_name || "Rider"),
            },
          });
        } else {
          console.warn("[OrderDetail] rider profile select", rErr);
          dispatch({ type: "UPDATE_RIDER_INFO", riderInfo: null });
        }
      } else {
        dispatch({ type: "UPDATE_RIDER_INFO", riderInfo: null });
      }

      /*
       * LEGACY_ISOLATED: `delivery_requests` + `trg_orders_delivery_request` are no longer used for new orders.
       * Order detail reads only `delivery_jobs`, `delivery_assignments`, and `delivery_events` (GreenHub pipeline).
       */
      const { data: evRows, error: evErr } = await supabase
        .from("order_events")
        .select("id, order_id, event_label, created_at, metadata")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

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
      setLoadRetryable(true);
      setError("We couldn’t load this order. Check your connection and try again.");
      dispatch({ type: "RESET_ORDER" as any }); // Placeholder action for reset
      setItems([]);
      setOrderEvents([]);
      setOrderMeta({ paymentMethod: null, paymentReference: null, deliveryFee: null, totalAmount: null });
      setDeliveryJobEvents([]);
      setDeliveryAssignments([]);
      setGreenhubJobStatus(null);
      setDeliveryAssignedRiderId(null);
      setBuyerDeliveryPin(null);
      setOrderDbStatus(null);
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

  const orderIdParam = id?.trim() ?? "";
  useEffect(() => {
    dispatch({ type: "CLEAR_RIDER_LOCATION" });
  }, [orderIdParam]);

  useEffect(() => {
    if (!orderIdParam || !authUser?.id) return;
    const channel = supabase
      .channel(`order-detail-job:${orderIdParam}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_jobs", filter: `order_id=eq.${orderIdParam}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderIdParam, authUser?.id, load]);

  const sellerHasLineOnOrder = useMemo(
    () => items.some((it) => String(it.seller_id ?? "") === authUser?.id?.trim()),
    [items, authUser?.id],
  );

  const showSellerMarkPaid = useMemo(
    () =>
      !loading &&
      !error &&
      !isBuyerView &&
      sellerHasLineOnOrder &&
      orderDbStatus === "pending_payment" &&
      (orderMeta.paymentMethod ?? "").toLowerCase() === "pod",
    [loading, error, isBuyerView, sellerHasLineOnOrder, orderDbStatus, orderMeta.paymentMethod],
  );

  const handleConfirmOrderPaid = useCallback(async () => {
    const oid = orderState.orderId?.trim();
    if (!oid) return;
    setMarkPaidSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("confirm_order_paid", { p_order_id: oid } as never);
      if (rpcErr) throw rpcErr;
      toast.success("Order marked paid. GreenHub dispatch can assign a rider.");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not mark order paid.");
    } finally {
      setMarkPaidSubmitting(false);
    }
  }, [orderState.orderId, load]);

  const addr = useMemo(() => shippingLines(orderState.pickupLocation.address ? { address: orderState.pickupLocation.address } : null), [orderState.pickupLocation.address]); // Assuming pickupLocation.address is a string

  const deliveryRequestTimeline = useMemo(() => {
    const st = orderState.status;
    const queuedLabel = greenhubJobStatus != null ? "GreenHub delivery job queued" : "Delivery queued";
    const steps: { key: string; label: string; done: boolean }[] = [
      { key: "pending", label: queuedLabel, done: true },
      { key: "assigned", label: "Rider assigned", done: ["ACCEPTED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF", "AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
      { key: "picked_up", label: "Picked up — on the way", done: ["AT_PICKUP", "EN_ROUTE_TO_DROPOFF", "AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
      { key: "delivered", label: "Delivered", done: ["AT_DROPOFF", "DELIVERED", "COMPLETED"].includes(st) },
    ];
    if (st.startsWith("CANCELLED")) {
      return [{ key: "cancelled", label: "Delivery cancelled", done: true }];
    }
    return steps;
  }, [orderState.status, greenhubJobStatus]);
  const liveRiderLocation = useMemo(
    () =>
      orderState.currentRiderLocation != null
        ? {
            lat: orderState.currentRiderLocation.lat,
            lng: orderState.currentRiderLocation.lng,
            bearing: orderState.currentRiderLocation.bearing,
            lastSeenAt:
              orderState.currentRiderLocation.lastSeenAt != null &&
              String(orderState.currentRiderLocation.lastSeenAt).trim() !== ""
                ? orderState.currentRiderLocation.lastSeenAt
                : null,
          }
        : null,
    [orderState.currentRiderLocation],
  );

  /** Buyer tracking map header — production wording (no “preview route”). */
  const buyerLiveMapStatusLine = useMemo(() => {
    if (liveRiderLocation) {
      return "Live rider location — updates about every 10s";
    }
    const riderAssigned = Boolean(deliveryAssignedRiderId?.trim()) || Boolean(orderState.riderInfo?.id?.trim());
    if (riderAssigned) {
      return "Waiting for rider location";
    }
    return "Waiting for rider assignment";
  }, [liveRiderLocation, deliveryAssignedRiderId, orderState.riderInfo?.id]);

  const trackingStage = useMemo<OrderTrackingStage>(
    () => baseTrackingStageFromOrderStatus(orderState.status),
    [orderState.status],
  );

  const orderUiState = useMemo(() => orderUiStateFromOrderStatus(orderState.status), [orderState.status]);
  const orderStatusLabel = useMemo(() => orderUiStatusLabel(orderUiState), [orderUiState]);

  const activeMapStatuses: OrderStateType[] = ["ACCEPTED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF"];

  const showBuyerTrackingStack = useMemo(() => {
    if (!isBuyerView) return false;
    const st = orderState.status;
    const inActiveRiderTracking = activeMapStatuses.includes(st);
    if (orderState.marketMode === "b2c") {
      return inActiveRiderTracking || st === "PENDING";
    }
    const c2cRiderAssigned = Boolean(greenhubJobStatus) && Boolean(deliveryAssignedRiderId);
    return c2cRiderAssigned && (inActiveRiderTracking || st === "PENDING");
  }, [isBuyerView, orderState.status, orderState.marketMode, greenhubJobStatus, deliveryAssignedRiderId]);

  useEffect(() => {
    if (!showBuyerTrackingStack || !orderIdParam || !deliveryAssignedRiderId || !authUser?.id) {
      dispatch({ type: "CLEAR_RIDER_LOCATION" });
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const { data, error } = await supabase.rpc("get_order_assigned_rider_presence", {
        p_order_id: orderIdParam,
      } as never);
      if (cancelled) return;
      if (error) {
        console.warn("[OrderDetail] get_order_assigned_rider_presence", error);
        return;
      }
      const rows = (data ?? []) as {
        rider_user_id: string;
        latitude: number | null;
        longitude: number | null;
        last_seen_at: string | null;
        is_online: boolean;
      }[];
      const row = rows[0];
      if (!row) {
        dispatch({ type: "CLEAR_RIDER_LOCATION" });
        return;
      }
      const lat = row.latitude;
      const lng = row.longitude;
      if (!row.is_online || lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        dispatch({ type: "CLEAR_RIDER_LOCATION" });
        return;
      }
      dispatch({
        type: "UPDATE_RIDER_LOCATION",
        lat: Number(lat),
        lng: Number(lng),
        bearing: null,
        lastSeenAt: row.last_seen_at ?? null,
      });
    };

    void tick();
    const intervalId = window.setInterval(() => void tick(), RIDER_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [showBuyerTrackingStack, orderIdParam, deliveryAssignedRiderId, authUser?.id]);

  const showC2cTrackingPlaceholderPanel = useMemo(
    () =>
      isBuyerView &&
      orderState.marketMode === "c2c" &&
      !showBuyerTrackingStack &&
      (!greenhubJobStatus || !deliveryAssignedRiderId) &&
      !orderState.status.startsWith("CANCELLED") &&
      !["DELIVERED", "COMPLETED"].includes(orderState.status),
    [
      isBuyerView,
      orderState.marketMode,
      showBuyerTrackingStack,
      greenhubJobStatus,
      deliveryAssignedRiderId,
      orderState.status,
    ],
  );

  const buyerRiderCardStatusLabel = useMemo(() => {
    if (!isBuyerView) return orderStatusLabel;
    if (
      orderState.marketMode === "c2c" &&
      (!greenhubJobStatus || !deliveryAssignedRiderId) &&
      !orderState.status.startsWith("CANCELLED") &&
      !["DELIVERED", "COMPLETED"].includes(orderState.status)
    ) {
      return "Waiting for seller to prepare order";
    }
    return orderStatusLabel;
  }, [
    isBuyerView,
    orderState.marketMode,
    orderState.status,
    greenhubJobStatus,
    deliveryAssignedRiderId,
    orderStatusLabel,
  ]);

  const hasGuaranteedItems = useMemo(
    () => items.some((it) => isWarehouseShippingFulfillment(it.fulfillment_type)),
    [items],
  );

  const safeEstimatedArrival = useMemo(() => {
    const t = orderState.estimatedArrivalTime;
    if (t == null) return null;
    const s = typeof t === "string" ? t.trim() : String(t).trim();
    return s.length > 0 ? s : null;
  }, [orderState.estimatedArrivalTime]);

  const mapPickupLocation = useMemo(() => {
    if (hasGuaranteedItems) return { lat: DEFAULT_HUB_LAT, lng: DEFAULT_HUB_LNG };
    const p = orderState.pickupLocation;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { lat: p.lat, lng: p.lng };
    return { lat: DEFAULT_HUB_LAT, lng: DEFAULT_HUB_LNG };
  }, [hasGuaranteedItems, orderState.pickupLocation]);

  const mapDropoffLocation = useMemo(() => {
    const p = orderState.dropoffLocation;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { lat: p.lat, lng: p.lng };
    return mapPickupLocation;
  }, [orderState.dropoffLocation, mapPickupLocation]);

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
  const hasReviewableItems = useMemo(() => items.some((item) => !item.is_reviewed), [items]);
  const resolvedActions = useMemo(
    () => getOrderActions(orderUiState, isBuyerView, orderState.riderInfo, orderState.orderId, hasReviewableItems),
    [orderUiState, isBuyerView, orderState.riderInfo, orderState.orderId, hasReviewableItems],
  );

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

  const handleOrderAction = useCallback(async (actionType: OrderActionType, payload?: any) => {
    if (!authUser?.id || !orderState.orderId) {
      toast.error("User not authenticated or order not loaded.");
      return;
    }

    setReviewSubmitting(true);
    try {
      switch (actionType) {
        case "CANCEL_ORDER": {
          /**
           * Buyer cancel button is only offered in `searching_rider` UI (OrderActionEngine).
           * Server RPC `buyer_cancel_order` additionally blocks shipped lines and rider jobs past
           * queued/assigned — see migration 20260712130000_buyer_cancel_order_rpc.sql.
           */
          const oid = orderState.orderId?.trim();
          if (!oid) {
            toast.error("Order not loaded.");
            break;
          }
          const { error: cancelErr } = await supabase.rpc("buyer_cancel_order", { p_order_id: oid });
          if (cancelErr) {
            toast.error(formatBuyerCancelOrderError(cancelErr));
            break;
          }
          toast.success("Your order was cancelled.");
          await load();
          break;
        }
        case "MESSAGE_RIDER": {
          const rid = typeof payload?.riderId === "string" ? payload.riderId.trim() : "";
          if (rid) navigate(`/messages/u/${rid}`);
          else toast.error("Rider is not available to message yet.");
          break;
        }
        case "CALL_RIDER": {
          const phone = typeof payload?.riderPhone === "string" ? payload.riderPhone.trim() : "";
          if (phone) {
            window.location.href = `tel:${phone.replace(/\s/g, "")}`;
          } else {
            toast.error("Rider phone number not available.");
          }
          break;
        }
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
          navigate(-1);
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
  }, [authUser?.id, orderState.orderId, reviewItem, reviewRating, reviewText, reviewAnonymous, navigate, items, dispatch, load]);


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
        <p className="mx-auto mb-2 max-w-md text-gray-800">{error || "Order not found."}</p>
        {loadRetryable ? (
          <button
            type="button"
            onClick={() => void load()}
            className={`${orderTrackBtnPrimary} mb-4`}
          >
            Retry
          </button>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {goBackAction ? (
            <button
              type="button"
              onClick={() => handleOrderAction(goBackAction.actionType, goBackAction.payload)}
              className={orderTrackBtnPrimary}
            >
              {goBackAction.label}
            </button>
          ) : null}
          {getHelpAction ? (
            <button
              type="button"
              onClick={() => handleOrderAction(getHelpAction.actionType, getHelpAction.payload)}
              className={orderTrackBtnSecondaryInline}
            >
              {getHelpAction.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          {resolvedActions.passive?.find((a) => a.actionType === "GO_BACK") ? (
            <button
              type="button"
              onClick={() => handleOrderAction("GO_BACK")}
              className="rounded-lg p-2 -ml-2 text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2"
              aria-label="Back to previous page"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">
              {isBuyerView ? "Order Details" : "Fulfillment · Order"}
            </h1>
            <p className="text-sm text-gray-600 font-mono truncate">{orderState.orderId}</p>
            <p className="mt-1.5">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  orderState.marketMode === "b2c"
                    ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200/80"
                    : "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
                }`}
              >
                {orderState.marketMode === "b2c" ? "Store delivery" : "Marketplace delivery"}
              </span>
            </p>
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

        {showSellerMarkPaid ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">Pay on delivery — confirm payment received</p>
            <p className="mt-1 text-xs text-amber-900/85">
              Marks this order as paid so GreenHub can create a delivery job. Only use after you have received payment from the buyer.
            </p>
            <button
              type="button"
              disabled={markPaidSubmitting}
              onClick={() => void handleConfirmOrderPaid()}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markPaidSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Mark order paid
            </button>
          </div>
        ) : null}

        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Items Ordered</h2>
          <div className="space-y-4">
            {items.map((item, idx) => {
              const sid = item.seller_id || "";
              const sp = sid ? sellers.get(sid) : undefined;
              const sName = sp?.full_name?.trim() || "Seller";
              const sAvatar = getAvatarUrl(sp?.avatar_url ?? null, sp?.gender ?? null, sName);
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
          <div className="w-full rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm md:mx-auto md:max-w-3xl md:p-5 lg:mx-0 lg:max-w-none">
            <div className="mb-3 flex items-center gap-2">
              <Truck className="h-5 w-5 shrink-0 text-sky-700" aria-hidden />
              <h2 className="font-semibold text-sky-950">Rider delivery</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-800">
              Status:{" "}
              <span className="font-medium text-gray-900">
                {showBuyerTrackingStack ? safeText(trackingStageHeadline(trackingStage)) : safeText(buyerRiderCardStatusLabel)}
              </span>
              {orderState.estimatedArrivalTime && !showBuyerTrackingStack ? (
                <span className="text-sm font-normal text-gray-500"> · Arriving {orderState.estimatedArrivalTime}</span>
              ) : null}
            </p>
            {greenhubJobStatus ? (
              <p className="mt-1 text-xs text-gray-600">
                GreenHub job: <span className="font-medium text-gray-800">{deliveryJobStatusLabel(greenhubJobStatus)}</span>
              </p>
            ) : null}
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
            {buyerDeliveryPin && ["ACCEPTED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF", "AT_DROPOFF"].includes(orderState.status) ? (
              <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Handoff PIN</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-[0.08em] text-amber-950">{buyerDeliveryPin}</p>
                <p className="mt-1 text-[11px] text-amber-900/70">Share only with your rider at the door.</p>
              </div>
            ) : null}
            {deliveryJobEvents.length > 0 ? (
              <div className="mt-3 border-t border-sky-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">Dispatch activity</p>
                <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs text-gray-600" aria-label="Delivery job events">
                  {deliveryJobEvents.map((ev) => (
                    <li key={ev.id} className="flex flex-wrap gap-x-2 border-b border-sky-50/80 pb-1.5 last:border-0">
                      <span className="font-medium text-gray-800">{String(ev.event_type || "").replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-gray-500">{formatOrderEventTime(ev.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="sr-only">Loaded {deliveryAssignments.length} assignment record(s) for this delivery job.</p>
            {isBuyerView &&
            ["EN_ROUTE_TO_PICKUP", "AT_PICKUP", "EN_ROUTE_TO_DROPOFF"].includes(orderState.status) &&
            orderState.dropoffLocation.address ? (
              <div className="mt-3 rounded-lg border border-sky-300/60 bg-white/90 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">Delivery Address</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-[0.05em] text-sky-950">{orderState.dropoffLocation.address}</p>
              </div>
            ) : null}
            {showBuyerTrackingStack ? (
              <div
                className={cn(
                  "mt-4 flex min-w-0 flex-col overflow-hidden rounded-xl border border-sky-200/80 bg-white shadow-inner",
                  "min-h-[420px] transition-[box-shadow] duration-200",
                  "md:mt-5 md:min-h-[460px] md:rounded-2xl md:shadow-md",
                  "lg:mx-0 lg:mt-5 lg:max-h-[min(72vh,640px)] lg:min-h-[min(72vh,640px)] lg:flex-row lg:items-stretch lg:rounded-xl lg:shadow-inner",
                )}
              >
                <section
                  aria-label="Live delivery map"
                  className="flex min-h-0 min-w-0 flex-shrink-0 flex-col bg-slate-50/30 lg:h-full lg:basis-[68%] lg:max-w-[68%]"
                >
                  <p className="shrink-0 border-b border-sky-100 bg-sky-50/80 px-4 py-2 text-xs font-medium leading-snug text-slate-600 md:px-5 md:py-2.5 md:text-[13px]">
                    {buyerLiveMapStatusLine}
                  </p>
                  <div
                    className={cn(
                      "relative isolate w-full min-w-0 flex-1 overflow-hidden bg-gray-100",
                      "min-h-[220px] h-[min(40vh,360px)]",
                      "md:min-h-[260px] md:h-[min(44vh,440px)]",
                      "lg:h-full lg:min-h-0 lg:flex-1 lg:self-stretch",
                    )}
                  >
                    <Suspense fallback={<MapSkeleton />}>
                      <DeliveryTrackingMap
                        className="absolute inset-0 box-border h-full min-h-[220px] min-w-0 w-full max-w-full rounded-none border-0"
                        riderLocation={liveRiderLocation}
                        pickupLocation={mapPickupLocation}
                        dropoffLocation={mapDropoffLocation}
                        enableDemoRiderMovement={false}
                      />
                    </Suspense>
                  </div>
                </section>

                <section
                  aria-label="Delivery status and actions"
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col border-t border-sky-100 bg-white",
                    "lg:h-full lg:max-h-none lg:basis-[32%] lg:max-w-[32%] lg:min-w-0 lg:flex-shrink-0 lg:border-l lg:border-t-0",
                  )}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                    <OrderStatusPanel
                      stage={trackingStage}
                      rider={orderState.riderInfo}
                      estimatedArrivalTime={safeEstimatedArrival}
                    />
                  </div>
                  <OrderActionBar
                    className="shrink-0 lg:border-t lg:border-slate-200/90"
                    stage={trackingStage}
                    rider={orderState.riderInfo}
                    orderId={orderState.orderId}
                    onAction={handleOrderAction}
                  />
                </section>
              </div>
            ) : showC2cTrackingPlaceholderPanel ? (
              <div className="mt-4 flex min-h-[280px] min-w-0 flex-col items-center justify-center rounded-xl border border-sky-200/80 bg-gradient-to-b from-sky-50/90 to-white px-4 py-10 text-center shadow-inner md:mx-auto md:min-h-[320px] md:max-w-3xl md:rounded-2xl md:px-6 md:py-12 lg:mx-0 lg:max-w-none">
                <Truck className="mb-3 h-10 w-10 text-sky-600/80" aria-hidden />
                <p className="text-sm font-semibold text-slate-900">Waiting for seller to prepare order</p>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-600">
                  Live map tracking will appear here once a rider is assigned to your delivery.
                </p>
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

        {!showBuyerTrackingStack ? (
          <OrderFooterActions
            orderUiState={orderUiState}
            isBuyerView={isBuyerView}
            riderInfo={orderState.riderInfo}
            orderId={orderState.orderId}
            hasReviewableItems={hasReviewableItems}
            onAction={handleOrderAction}
          />
        ) : null}
      </div>
      {reviewItem ? (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl sm:p-5">
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

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleOrderAction("CANCEL_REVIEW_RATING")}
                disabled={reviewSubmitting}
                className={orderTrackBtnSecondaryInline}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleOrderAction("SUBMIT_RATING")}
                disabled={reviewSubmitting}
                className={orderTrackBtnPrimary}
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
