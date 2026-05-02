import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Package, Smartphone } from "@/app/icons/emojiLucide";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { DeclineButton } from "../../components/rider/DeclineButton";

type DeliveryJobRow = {
  id: string;
  order_id: string;
  status: string | null;
  assigned_rider_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
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

type AssignmentOfferRow = {
  job_id: string;
  status: string;
  delivery_jobs: DeliveryJobRow | DeliveryJobRow[] | null;
};

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const msg = String(e.message ?? "").toLowerCase();
  return e.code === "42P01" || msg.includes("does not exist");
}

function statusLabel(s: string | null | undefined): string {
  const x = String(s || "").toLowerCase();
  const m: Record<string, string> = {
    pending_dispatch: "Queued for dispatch",
    assigned: "Assigned — accept to start",
    accepted: "Accepted",
    arrived_pickup: "At pickup",
    picked_up: "Picked up",
    en_route: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
    failed: "Failed",
    pending: "Pending pickup",
    rejected: "Declined",
  };
  return m[x] || x || "—";
}

export default function RiderDashboard() {
  const { user } = useAuth();
  const [riderRow, setRiderRow] = useState<RiderTableRow | null | undefined>(undefined);
  const [available, setAvailable] = useState<DeliveryJobRow[]>([]);
  const [mine, setMine] = useState<DeliveryJobRow[]>([]);
  const [myProductRideBookings, setMyProductRideBookings] = useState<ProductRideBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingProductRideBookingsTable, setMissingProductRideBookingsTable] = useState(false);
  const [vehicleType, setVehicleType] = useState("");
  const [applying, setApplying] = useState(false);

  const uid = user?.id?.trim() ?? "";

  const loadRiderProfile = useCallback(async () => {
    if (!uid) {
      setRiderRow(undefined);
      return;
    }
    const { data, error } = await supabase.from("greenhub_riders").select("user_id, status, vehicle_type").eq("user_id", uid).maybeSingle();
    if (error) {
      console.warn("[RiderDashboard] greenhub_riders", error);
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
      const { data: mineData, error: eMine } = await supabase.rpc("rider_list_my_delivery_jobs");
      if (eMine) throw eMine;
      const mineJobs = (mineData as DeliveryJobRow[]) ?? [];
      const active = mineJobs.filter((j) => {
        const s = String(j.status || "").toLowerCase();
        return !["delivered", "cancelled", "failed"].includes(s);
      });
      setMine(active);

      const { data: offeredData, error: eOffer } = await supabase
        .from("delivery_assignments")
        .select("job_id, status, delivery_jobs ( id, order_id, status, assigned_rider_id, created_at, updated_at )")
        .eq("rider_user_id", uid)
        .eq("status", "offered");
      if (eOffer) throw eOffer;
      const open: DeliveryJobRow[] = [];
      for (const row of (offeredData as AssignmentOfferRow[]) ?? []) {
        const dj = Array.isArray(row.delivery_jobs) ? row.delivery_jobs[0] : row.delivery_jobs;
        if (dj?.id) open.push(dj);
      }
      setAvailable(open);

      const { data: productRideData, error: e3 } = await supabase
        .from("product_ride_bookings")
        .select("id, product_id, status, pickup_address, dropoff_address, created_at")
        .eq("assigned_rider_id", uid)
        .in("status", ["assigned", "accepted", "en_route"])
        .order("updated_at", { ascending: false });
      if (e3) {
        if (!isMissingRelationError(e3)) throw e3;
        setMissingProductRideBookingsTable(true);
        setMyProductRideBookings([]);
      } else {
        setMissingProductRideBookingsTable(false);
        setMyProductRideBookings((productRideData as ProductRideBookingRow[]) ?? []);
      }
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

  useEffect(() => {
    if (!uid) return;
    const deliveryChannel = supabase
      .channel(`rider-dashboard-delivery:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" }, () => {
        void loadJobs();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_assignments", filter: `rider_user_id=eq.${uid}` },
        () => {
          void loadJobs();
        },
      )
      .subscribe();

    const productRideChannel = supabase
      .channel(`rider-dashboard-product-rides:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_ride_bookings" }, () => {
        void loadJobs();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(deliveryChannel);
      void supabase.removeChannel(productRideChannel);
    };
  }, [uid, loadJobs]);

  const applyProfile = async () => {
    if (!uid) return;
    setApplying(true);
    try {
      const { error } = await supabase.rpc("rider_apply_greenhub", { p_vehicle_type: vehicleType.trim() || null });
      if (error) throw error;
      toast.success("Application saved", { description: "An admin will approve your rider profile." });
      await loadRiderProfile();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setApplying(false);
    }
  };

  const acceptRequest = async (jobId: string) => {
    try {
      const { error } = await supabase.rpc("rider_accept_delivery_job", { p_job_id: jobId });
      if (error) throw error;
      toast.success("Job accepted");
      await loadJobs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not accept");
    }
  };

  const rs = useMemo(() => String(riderRow?.status ?? "").toLowerCase(), [riderRow]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-white">Delivery dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">GreenHub delivery jobs assigned to you or offered by dispatch.</p>

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
      ) : rs === "suspended" ? (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">Your rider account is suspended.</p>
      ) : null}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-hidden />
        </div>
      ) : (
        <>
          {missingProductRideBookingsTable ? (
            <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              Product ride bookings are temporarily unavailable because the backend table
              <code className="mx-1 rounded bg-amber-900/40 px-1.5 py-0.5 text-[11px]">product_ride_bookings</code>
              is missing. Ask an admin to run the latest rider dispatch migrations.
            </div>
          ) : null}
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
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-3 text-sm">
                      <Link to={`/rider/product-rides/${encodeURIComponent(b.id)}`} className="block hover:opacity-90">
                        <p className="font-medium text-white">Ride booking {b.id.slice(0, 8)}…</p>
                        <p className="mt-0.5 text-xs text-emerald-100/80">{statusLabel(b.status)}</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Pickup: <span className="text-slate-400">{b.pickup_address}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-300">
                          Dropoff: <span className="text-slate-400">{b.dropoff_address}</span>
                        </p>
                      </Link>
                      {["assigned", "accepted"].includes(String(b.status || "").toLowerCase()) ? (
                        <div className="mt-2">
                          <DeclineButton
                            type="product_ride_booking"
                            id={b.id}
                            onDeclined={() =>
                              setMyProductRideBookings((prev) => prev.filter((row) => row.id !== b.id))
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-200">Available jobs</h2>
            {available.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No jobs offered to you right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {available.map((r) => (
                  <li key={r.id}>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-sm">
                      <Link
                        to={`/rider/requests/${encodeURIComponent(r.id)}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <Package className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">Order {String(r.order_id).slice(0, 8)}…</p>
                          <p className="text-xs text-slate-500">{statusLabel(r.status)}</p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void acceptRequest(r.id)}
                        className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Accept
                      </button>
                    </div>
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
