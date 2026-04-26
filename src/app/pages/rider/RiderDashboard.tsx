import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Package, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";

type DeliveryRequestRow = {
  id: string;
  order_id: string;
  status: string | null;
  assigned_rider_id: string | null;
  created_at: string | null;
};

type RiderTableRow = {
  user_id: string;
  status: string;
  vehicle_type: string | null;
};

type ProductRideBookingRow = {
  id: string;
  product_id: string;
  status: string | null;
  pickup_address: string;
  dropoff_address: string;
  created_at: string | null;
};

function statusLabel(s: string | null | undefined): string {
  const x = String(s || "").toLowerCase();
  const m: Record<string, string> = {
    pending: "Pending pickup",
    assigned: "Assigned to you",
    picked_up: "Picked up",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return m[x] || x || "—";
}

export default function RiderDashboard() {
  const { user } = useAuth();
  const [riderRow, setRiderRow] = useState<RiderTableRow | null | undefined>(undefined);
  const [available, setAvailable] = useState<DeliveryRequestRow[]>([]);
  const [mine, setMine] = useState<DeliveryRequestRow[]>([]);
  const [myProductRideBookings, setMyProductRideBookings] = useState<ProductRideBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleType, setVehicleType] = useState("");
  const [applying, setApplying] = useState(false);

  const uid = user?.id?.trim() ?? "";

  const loadRiderProfile = useCallback(async () => {
    if (!uid) {
      setRiderRow(undefined);
      return;
    }
    const { data, error } = await supabase.from("riders").select("user_id, status, vehicle_type").eq("user_id", uid).maybeSingle();
    if (error) {
      console.warn("[RiderDashboard] riders", error);
      setRiderRow(null);
      return;
    }
    setRiderRow((data as RiderTableRow) ?? null);
  }, [uid]);

  const loadJobs = useCallback(async () => {
    if (!uid) {
      setAvailable([]);
      setMine([]);
      return;
    }
    setLoading(true);
    try {
      const { data: open, error: e1 } = await supabase
        .from("delivery_requests")
        .select("id, order_id, status, assigned_rider_id, created_at")
        .eq("status", "pending")
        .is("assigned_rider_id", null)
        .order("created_at", { ascending: false });
      if (e1) throw e1;
      setAvailable((open as DeliveryRequestRow[]) ?? []);

      const { data: active, error: e2 } = await supabase
        .from("delivery_requests")
        .select("id, order_id, status, assigned_rider_id, created_at")
        .eq("assigned_rider_id", uid)
        .in("status", ["assigned", "picked_up"])
        .order("updated_at", { ascending: false });
      if (e2) throw e2;
      setMine((active as DeliveryRequestRow[]) ?? []);

      const { data: productRideData, error: e3 } = await supabase
        .from("product_ride_bookings")
        .select("id, product_id, status, pickup_address, dropoff_address, created_at")
        .eq("assigned_rider_id", uid)
        .in("status", ["assigned", "accepted", "en_route"])
        .order("updated_at", { ascending: false });
      if (e3) throw e3;
      setMyProductRideBookings((productRideData as ProductRideBookingRow[]) ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load deliveries");
      setAvailable([]);
      setMine([]);
      setMyProductRideBookings([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadRiderProfile();
  }, [loadRiderProfile]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const applyProfile = async () => {
    if (!uid) return;
    setApplying(true);
    try {
      const { error } = await supabase.rpc("rider_apply_rider_profile", { p_vehicle_type: vehicleType.trim() || null });
      if (error) throw error;
      toast.success("Application saved", { description: "An admin will approve your rider profile." });
      await loadRiderProfile();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setApplying(false);
    }
  };

  const rs = useMemo(() => String(riderRow?.status ?? "").toLowerCase(), [riderRow]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-white">Delivery dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">Open jobs and your active runs. GPS updates only on the request page.</p>

      <section className="mt-5 rounded-2xl border border-slate-700/80 bg-slate-900/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">PWA</h2>
        <p className="mt-1 flex items-start gap-2 text-xs text-slate-400">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Add to Home Screen for a full-screen rider experience.
        </p>
      </section>

      {riderRow === undefined ? (
        <div className="mt-6 flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-hidden />
        </div>
      ) : !riderRow ? (
        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-white">Rider profile</h2>
          <p className="mt-1 text-xs text-slate-400">Create your rider record for admin approval.</p>
          <input
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            placeholder="Vehicle (optional)"
            className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={applying}
            onClick={() => void applyProfile()}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {applying ? "Saving…" : "Submit rider application"}
          </button>
        </section>
      ) : rs === "pending" ? (
        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Your rider profile is <strong>pending</strong>. You can browse open jobs but cannot accept until an admin approves you.
        </p>
      ) : rs === "blocked" ? (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">Your rider account is blocked.</p>
      ) : null}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-hidden />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-emerald-200">My active jobs</h2>
            {mine.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No active deliveries.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {mine.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/rider/requests/${encodeURIComponent(r.id)}`}
                      className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-3 text-sm hover:bg-emerald-950/40"
                    >
                      <Package className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">Order {String(r.order_id).slice(0, 8)}…</p>
                        <p className="text-xs text-emerald-100/70">{statusLabel(r.status)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-emerald-200">My product ride bookings</h2>
            {myProductRideBookings.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No assigned product ride bookings.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {myProductRideBookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/rider/product-rides/${encodeURIComponent(b.id)}`}
                      className="block rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-3 text-sm hover:bg-emerald-950/35"
                    >
                      <p className="font-medium text-white">Ride booking {b.id.slice(0, 8)}…</p>
                      <p className="mt-0.5 text-xs text-emerald-100/80">{statusLabel(b.status)}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        Pickup: <span className="text-slate-400">{b.pickup_address}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-300">
                        Dropoff: <span className="text-slate-400">{b.dropoff_address}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-200">Available jobs</h2>
            {available.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No open requests right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {available.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/rider/requests/${encodeURIComponent(r.id)}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-sm hover:border-emerald-500/40"
                    >
                      <Package className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">Order {String(r.order_id).slice(0, 8)}…</p>
                        <p className="text-xs text-slate-500">{statusLabel(r.status)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
