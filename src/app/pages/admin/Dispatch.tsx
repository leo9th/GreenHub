import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Loader2, MapPin, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";

type RequestRow = {
  id: string;
  order_id: string;
  status: string | null;
  assigned_rider_id: string | null;
  created_at: string | null;
};

type ProductRideBookingRow = {
  id: string;
  product_id: string;
  status: string | null;
  assigned_rider_id: string | null;
  created_at: string | null;
  user_id: string;
  assigned_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  delivered_at: string | null;
};

type RiderRow = {
  user_id: string;
  status: string;
  vehicle_type: string | null;
  last_location_at?: string | null;
};

type TrackingRow = {
  id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  rider_user_id: string;
};

type NearbyRiderRow = {
  rider_user_id: string;
  distance_km: number;
  last_seen_at: string | null;
  is_online: boolean;
};

const LIVE_PRESENCE_THRESHOLD_MS = 90_000;

function formatTs(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function renderRideTimeline(b: ProductRideBookingRow): string {
  return [
    `Assigned: ${formatTs(b.assigned_at)}`,
    `Accepted: ${formatTs(b.accepted_at)}`,
    `En route: ${formatTs(b.en_route_at)}`,
    `Delivered: ${formatTs(b.delivered_at)}`,
  ].join(" | ");
}

function getPresenceFreshness(
  lastSeenAt: string | null,
  isOnline: boolean,
): { label: "Live" | "Stale" | "Offline"; className: string } {
  if (!isOnline || !lastSeenAt) {
    return {
      label: "Offline",
      className: "border-slate-600 bg-slate-800 text-slate-300",
    };
  }
  const ts = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ts)) {
    return {
      label: "Stale",
      className: "border-amber-600/40 bg-amber-950/30 text-amber-200",
    };
  }
  const ageMs = Date.now() - ts;
  if (ageMs <= LIVE_PRESENCE_THRESHOLD_MS) {
    return {
      label: "Live",
      className: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
    };
  }
  return {
    label: "Stale",
    className: "border-amber-600/40 bg-amber-950/30 text-amber-200",
  };
}

export default function AdminDispatch() {
  const [tab, setTab] = useState<"jobs" | "riders" | "history">("jobs");
  const [jobs, setJobs] = useState<RequestRow[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [productRideBookings, setProductRideBookings] = useState<ProductRideBookingRow[]>([]);
  const [pending, setPending] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignRiderByJob, setAssignRiderByJob] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [historyRequestId, setHistoryRequestId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<TrackingRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [findingNearbyId, setFindingNearbyId] = useState<string | null>(null);
  const [autoAssigningId, setAutoAssigningId] = useState<string | null>(null);
  const [nearbyByBooking, setNearbyByBooking] = useState<Record<string, NearbyRiderRow[]>>({});
  const [lastSyncSeconds, setLastSyncSeconds] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const approvedRiders = useMemo(() => riders.filter((r) => String(r.status).toLowerCase() === "approved"), [riders]);

  const resetFreshness = useCallback(() => {
    setLastSyncSeconds(0);
    setIsStale(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setLastSyncSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (lastSyncSeconds > 30) {
      setIsStale(true);
    }
  }, [lastSyncSeconds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, rRes, prbRes] = await Promise.all([
        supabase.from("delivery_requests").select("id, order_id, status, assigned_rider_id, created_at").order("created_at", { ascending: false }),
        supabase.from("riders").select("user_id, status, vehicle_type").order("created_at", { ascending: false }),
        supabase
          .from("product_ride_bookings")
          .select("id, product_id, status, assigned_rider_id, created_at, user_id, assigned_at, accepted_at, en_route_at, delivered_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (jRes.error) throw jRes.error;
      if (rRes.error) throw rRes.error;
      if (prbRes.error) throw prbRes.error;
      setJobs((jRes.data as RequestRow[]) ?? []);
      const allR = (rRes.data as RiderRow[]) ?? [];
      setRiders(allR);
      setProductRideBookings((prbRes.data as ProductRideBookingRow[]) ?? []);
      setPending(allR.filter((x) => String(x.status).toLowerCase() === "pending"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load dispatch data");
      setJobs([]);
      setRiders([]);
      setProductRideBookings([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = async (requestId: string) => {
    setHistoryRequestId(requestId);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("delivery_tracking")
        .select("id, latitude, longitude, recorded_at, rider_user_id")
        .eq("delivery_request_id", requestId)
        .order("recorded_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setHistoryRows((data as TrackingRow[]) ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load tracking");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const assign = async (jobId: string) => {
    const riderId = assignRiderByJob[jobId]?.trim();
    if (!riderId) {
      toast.message("Pick a rider first");
      return;
    }
    setAssigningId(jobId);
    try {
      const { error } = await supabase.rpc("admin_assign_delivery_request", {
        p_request_id: jobId,
        p_rider_user_id: riderId,
      });
      if (error) throw error;
      toast.success("Rider assigned");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setAssigningId(null);
    }
  };

  const assignProductRideBooking = async (bookingId: string) => {
    const riderId = assignRiderByJob[bookingId]?.trim();
    if (!riderId) {
      toast.message("Pick a rider first");
      return;
    }
    setAssigningId(bookingId);
    try {
      const { error } = await supabase.rpc("admin_assign_product_ride_booking", {
        p_booking_id: bookingId,
        p_rider_user_id: riderId,
      });
      if (error) throw error;
      toast.success("Rider assigned to product ride booking");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setAssigningId(null);
    }
  };

  const findNearbyRiders = useCallback(async (bookingId: string, silent = false) => {
    setFindingNearbyId(bookingId);
    try {
      const { data, error } = await supabase.rpc("admin_find_nearby_riders_for_product_booking", {
        p_booking_id: bookingId,
        p_limit: 8,
        p_radius_km: 5,
      });
      if (error) throw error;
      setNearbyByBooking((prev) => ({ ...prev, [bookingId]: (data as NearbyRiderRow[]) ?? [] }));
      resetFreshness();
      if (!silent) {
        if (!data || (Array.isArray(data) && data.length === 0)) {
          toast.message("No nearby online riders found.");
        } else {
          toast.success("Nearby riders loaded.");
        }
      }
    } catch (e: unknown) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Could not find nearby riders");
      setNearbyByBooking((prev) => ({ ...prev, [bookingId]: [] }));
    } finally {
      setFindingNearbyId(null);
    }
  }, [resetFreshness]);

  const autoAssignNearest = async (bookingId: string) => {
    setAutoAssigningId(bookingId);
    try {
      const { data, error } = await supabase.rpc("admin_auto_assign_nearest_product_booking_rider", {
        p_booking_id: bookingId,
        p_radius_km: 5,
      });
      if (error) throw error;
      toast.success(`Nearest rider assigned ${String(data || "").slice(0, 8)}…`);
      await load();
      await findNearbyRiders(bookingId, true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Auto-assign failed");
    } finally {
      setAutoAssigningId(null);
    }
  };

  useEffect(() => {
    const trackedBookingIds = Object.keys(nearbyByBooking).filter((id) => nearbyByBooking[id]?.length);
    if (tab !== "jobs" || trackedBookingIds.length === 0) return;

    const refreshNearby = () => {
      resetFreshness();
      trackedBookingIds.forEach((bookingId) => {
        void findNearbyRiders(bookingId, true);
      });
    };

    const presenceChannel = supabase
      .channel("admin-rider-presence-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_presence" }, refreshNearby)
      .subscribe();

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [tab, nearbyByBooking, findNearbyRiders, resetFreshness]);

  const approveRider = async (userId: string) => {
    try {
      const { error } = await supabase.rpc("admin_set_rider_table_status", {
        p_user_id: userId,
        p_status: "approved",
      });
      if (error) throw error;
      toast.success("Rider approved");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    }
  };

  const blockRider = async (userId: string) => {
    try {
      const { error } = await supabase.rpc("admin_set_rider_table_status", {
        p_user_id: userId,
        p_status: "blocked",
      });
      if (error) throw error;
      toast.success("Rider blocked");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#0b1220]">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-[#0b1220] via-[#0d1629] to-[#0b1220] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-300 sm:text-3xl">Rider delivery</h1>
            <p className="mt-1 text-sm text-emerald-100/60">Requests, riders, and GPS history.</p>
          </div>
          <Link to="/admin/dashboard" className="text-sm text-emerald-200/80 hover:text-emerald-300">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-700/80 pb-3">
          {(
            [
              ["jobs", "Delivery jobs", Truck],
              ["riders", "Riders", Users],
              ["history", "Location history", MapPin],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                if (key !== "history") {
                  setHistoryRequestId(null);
                  setHistoryRows([]);
                }
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                tab === key ? "bg-emerald-600 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {tab === "riders" ? (
          <section className="rounded-2xl border border-emerald-500/20 bg-[#0d1629]/80 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Pending applications</h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">None.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-700/80">
                {pending.map((p) => (
                  <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                    <p className="font-mono text-sm text-slate-200">{p.user_id}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void approveRider(p.user_id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void blockRider(p.user_id)}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        Block
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mt-8 text-lg font-semibold text-white">All riders</h2>
            <ul className="mt-2 divide-y divide-slate-800 text-sm">
              {riders.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs text-slate-300">{r.user_id}</span>
                  <span className="text-slate-400">{r.status}</span>
                  {String(r.status).toLowerCase() === "approved" ? (
                    <button type="button" onClick={() => void blockRider(r.user_id)} className="text-xs text-rose-300 hover:underline">
                      Block
                    </button>
                  ) : String(r.status).toLowerCase() === "blocked" ? (
                    <button type="button" onClick={() => void approveRider(r.user_id)} className="text-xs text-emerald-300 hover:underline">
                      Approve
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "jobs" ? (
          <section className="space-y-6 rounded-2xl border border-emerald-500/20 bg-[#0d1629]/80 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-400" aria-hidden />
              <h2 className="text-lg font-semibold text-white">Delivery requests</h2>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-slate-400">No requests. Paid orders create a row automatically.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">Order</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Assign rider</th>
                      <th className="pb-2">Tracking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {jobs.map((j) => {
                      return (
                        <tr key={j.id} className="align-top">
                          <td className="py-3 pr-4 font-mono text-xs text-slate-300">{j.order_id}</td>
                          <td className="py-3 pr-4 text-slate-200">{j.status}</td>
                          <td className="py-3 pr-4">
                            {String(j.status || "").toLowerCase() === "pending" ||
                            String(j.status || "").toLowerCase() === "assigned" ? (
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <select
                                  value={assignRiderByJob[j.id] ?? ""}
                                  onChange={(e) => setAssignRiderByJob((m) => ({ ...m, [j.id]: e.target.value }))}
                                  className="max-w-[220px] rounded-lg border border-slate-600 bg-[#0b1220] px-2 py-1.5 text-xs text-white"
                                >
                                  <option value="">Select rider…</option>
                                  {approvedRiders.map((r) => (
                                    <option key={r.user_id} value={r.user_id}>
                                      {(r.user_id || "").slice(0, 8)}…
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={assigningId === j.id}
                                  onClick={() => void assign(j.id)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {assigningId === j.id ? "Saving…" : "Assign"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">{j.assigned_rider_id ? j.assigned_rider_id.slice(0, 8) + "…" : "—"}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setTab("history");
                                void loadHistory(j.id);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                            >
                              <ChevronRight className="h-4 w-4" />
                              History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-700/70 pt-4">
              <h3 className="text-sm font-semibold text-emerald-200">Product ride bookings</h3>
              {productRideBookings.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No product-origin ride bookings yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-4">Booking</th>
                        <th className="pb-2 pr-4">Product</th>
                        <th className="pb-2 pr-4">Requester</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Timeline</th>
                        <th className="pb-2 pr-4">Assign rider</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {productRideBookings.map((b) => (
                        <tr key={b.id} className="align-top">
                          <td className="py-3 pr-4 font-mono text-xs text-slate-300">{b.id.slice(0, 8)}…</td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-300">{String(b.product_id).slice(0, 10)}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-400">{b.user_id.slice(0, 8)}…</td>
                          <td className="py-3 pr-4 text-slate-200">{b.status}</td>
                          <td className="py-3 pr-4 text-xs text-slate-400">{renderRideTimeline(b)}</td>
                          <td className="py-3 pr-4">
                            {String(b.status || "").toLowerCase() === "pending" ||
                            String(b.status || "").toLowerCase() === "assigned" ? (
                              <div className="space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <select
                                    value={assignRiderByJob[b.id] ?? ""}
                                    onChange={(e) => setAssignRiderByJob((m) => ({ ...m, [b.id]: e.target.value }))}
                                    className="max-w-[220px] rounded-lg border border-slate-600 bg-[#0b1220] px-2 py-1.5 text-xs text-white"
                                  >
                                    <option value="">Select rider…</option>
                                    {approvedRiders.map((r) => (
                                      <option key={r.user_id} value={r.user_id}>
                                        {(r.user_id || "").slice(0, 8)}…
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={assigningId === b.id}
                                    onClick={() => void assignProductRideBooking(b.id)}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    {assigningId === b.id ? "Saving…" : "Assign"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={findingNearbyId === b.id}
                                    onClick={() => void findNearbyRiders(b.id)}
                                    className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    {findingNearbyId === b.id ? "Finding..." : "Find nearby"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={autoAssigningId === b.id}
                                    onClick={() => void autoAssignNearest(b.id)}
                                    className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                                  >
                                    {autoAssigningId === b.id ? "Assigning..." : "Auto-assign nearest"}
                                  </button>
                                </div>
                                <p className={`text-xs ${isStale ? "text-red-600" : "text-gray-400"}`}>
                                  {isStale ? "⚠️ Connection stale" : `Last sync: ${lastSyncSeconds}s ago`}
                                </p>
                                {nearbyByBooking[b.id]?.length ? (
                                  <ul className="space-y-1 rounded-md border border-slate-700 bg-[#0b1220] p-2 text-[11px] text-slate-300">
                                    {nearbyByBooking[b.id].map((n) => (
                                      <li key={n.rider_user_id} className="flex items-center justify-between gap-2 font-mono">
                                        <span>
                                          {n.rider_user_id.slice(0, 8)}… • {Number(n.distance_km).toFixed(2)}km • seen{" "}
                                          {n.last_seen_at ? new Date(n.last_seen_at).toLocaleTimeString() : "—"}
                                        </span>
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPresenceFreshness(n.last_seen_at, n.is_online).className}`}
                                        >
                                          {getPresenceFreshness(n.last_seen_at, n.is_online).label}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">{b.assigned_rider_id ? b.assigned_rider_id.slice(0, 8) + "…" : "—"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="rounded-2xl border border-emerald-500/20 bg-[#0d1629]/80 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Rider GPS history</h2>
            <p className="mt-1 text-sm text-slate-400">Pick a job from the Jobs tab, or enter a request id below.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {jobs.slice(0, 8).map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => void loadHistory(j.id)}
                  className={`rounded-lg border px-2 py-1 font-mono text-xs ${
                    historyRequestId === j.id ? "border-emerald-400 bg-emerald-900/40" : "border-slate-600 text-slate-300"
                  }`}
                >
                  {j.id.slice(0, 8)}…
                </button>
              ))}
            </div>
            {historyLoading ? (
              <div className="mt-6 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : historyRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No points loaded.</p>
            ) : (
              <ul className="mt-4 max-h-80 overflow-auto rounded-lg border border-slate-700 bg-[#0b1220] p-2 text-xs text-slate-400">
                {historyRows.map((h) => (
                  <li key={h.id} className="border-b border-slate-800/80 py-1 font-mono last:border-0">
                    {new Date(h.recorded_at).toISOString()} · {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)} · rider{" "}
                    {h.rider_user_id.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
