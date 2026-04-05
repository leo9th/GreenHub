import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { ArrowLeft, MapPin, Phone, MessageCircle, CheckCircle, Star } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { getAvatarUrl } from "../utils/getAvatar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

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
};

type OrderItemRow = {
  id?: string;
  order_id: string;
  product_id: string | number | null;
  seller_id: string | null;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  price_at_time: number | null;
  delivery_fee_at_time: number | null;
};

type SellerLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
  phone: string | null;
};

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

function buildTracking(statusRaw: string | null, createdAt: string | null) {
  const s = (statusRaw || "").toLowerCase();
  const placed = createdAt ? new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
  const steps = [
    { key: "placed", label: "Order placed", desc: "Your order has been received", done: true, date: placed },
    {
      key: "paid",
      label: "Payment",
      desc: s === "pending" || s === "awaiting_payment" ? "Awaiting payment" : "Payment recorded",
      done: !["pending", "awaiting_payment", "created"].includes(s),
      date: "",
    },
    {
      key: "proc",
      label: "Processing",
      desc: "Seller is preparing your items",
      done: ["processing", "paid", "confirmed", "shipped", "in_transit", "delivered", "completed"].includes(s),
      date: "",
    },
    {
      key: "ship",
      label: "Shipped",
      desc: "Your order is on the way",
      done: ["shipped", "in_transit", "delivered", "completed"].includes(s),
      date: "",
    },
    {
      key: "del",
      label: "Delivered",
      desc: "Order delivered",
      done: ["delivered", "completed"].includes(s),
      date: "",
    },
  ];
  return steps;
}

export default function OrderDetail() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [sellers, setSellers] = useState<Map<string, SellerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authUser?.id || !id?.trim()) {
      setOrder(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: ord, error: oErr } = await supabase.from("orders").select("*").eq("id", id.trim()).maybeSingle();

      if (oErr) throw oErr;
      if (!ord || String((ord as { buyer_id?: string }).buyer_id) !== authUser.id) {
        setOrder(null);
        setItems([]);
        setError("Order not found.");
        return;
      }

      setOrder(ord as OrderRow);

      const { data: its, error: iErr } = await supabase.from("order_items").select("*").eq("order_id", id.trim());

      if (iErr) throw iErr;

      const itemList = (its ?? []) as OrderItemRow[];
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

  const tracking = useMemo(
    () => buildTracking(order?.status ?? null, order?.created_at ?? null),
    [order?.status, order?.created_at],
  );

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
          onClick={() => navigate("/orders")}
          className="px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-medium"
        >
          Back to orders
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
            <h1 className="text-lg font-semibold text-gray-800">Order Details</h1>
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

              return (
                <div key={`${item.order_id}-${pid ?? idx}`}>
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

                  {isDelivered && pid ? (
                    <Link
                      to={`/reviews/${order.id}?productId=${encodeURIComponent(pid)}`}
                      className="mt-3 w-full py-2 border border-[#22c55e] text-[#22c55e] rounded-lg font-medium text-sm text-center flex items-center justify-center gap-2"
                    >
                      <Star className="w-4 h-4" />
                      Write Review
                    </Link>
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

        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Order Tracking</h2>
          <div className="space-y-4">
            {tracking.map((track, index) => (
              <div key={track.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      track.done ? "bg-[#22c55e]" : "bg-gray-200"
                    }`}
                  >
                    {track.done ? <CheckCircle className="w-5 h-5 text-white" /> : <div className="w-3 h-3 bg-white rounded-full" />}
                  </div>
                  {index < tracking.length - 1 ? (
                    <div className={`w-0.5 h-12 ${track.done ? "bg-[#22c55e]" : "bg-gray-200"}`} />
                  ) : null}
                </div>
                <div className="flex-1 pb-4">
                  <p className={`font-medium ${track.done ? "text-gray-800" : "text-gray-500"}`}>{track.label}</p>
                  <p className="text-sm text-gray-600">{track.desc}</p>
                  {track.date ? <p className="text-xs text-gray-500 mt-1">{track.date}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Payment Summary</h2>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium text-gray-800">{order.payment_method || "—"}</span>
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

        {isDelivered ? (
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
