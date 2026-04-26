import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { riderActionErrorMessage } from "../../utils/riderActionErrors";

type ProductRideBookingRow = {
  id: string;
  status: string | null;
  assigned_rider_id: string | null;
  pickup_address: string;
  dropoff_address: string;
  contact_phone: string;
  rider_note: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  delivered_at: string | null;
};

function statusLabel(status: string | null | undefined): string {
  const s = String(status || "").toLowerCase();
  if (s === "assigned") return "Assigned";
  if (s === "accepted") return "Accepted";
  if (s === "en_route") return "En route";
  if (s === "delivered") return "Delivered";
  if (s === "cancelled") return "Cancelled";
  if (s === "failed") return "Failed";
  if (s === "pending") return "Pending";
  return s || "Unknown";
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return "Pending";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Pending";
  return d.toLocaleString();
}

export default function RiderProductRideDetail() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const [row, setRow] = useState<ProductRideBookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const uid = user?.id?.trim() ?? "";
  const bid = bookingId?.trim() ?? "";

  const load = useCallback(async () => {
    if (!bid) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_ride_bookings")
        .select(
          "id, status, assigned_rider_id, pickup_address, dropoff_address, contact_phone, rider_note, assigned_at, accepted_at, en_route_at, delivered_at",
        )
        .eq("id", bid)
        .maybeSingle();
      if (error) throw error;
      setRow((data as ProductRideBookingRow) ?? null);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [bid]);

  useEffect(() => {
    void load();
  }, [load]);

  const callAction = async (rpcName: string, successMessage: string) => {
    if (!bid) return;
    setBusy(true);
    // #region agent log
    fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
      body: JSON.stringify({
        sessionId: "7ae02f",
        runId: "initial",
        hypothesisId: "H2_SERVER_REJECTION",
        location: "RiderProductRideDetail.tsx:83",
        message: "Rider product action RPC attempt",
        data: { rpcName, hasBookingId: Boolean(bid), statusBefore: String(row?.status || "").toLowerCase() },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const { error } = await supabase.rpc(rpcName, { p_booking_id: bid });
      if (error) throw error;
      toast.success(successMessage);
      await load();
    } catch (e: unknown) {
      // #region agent log
      fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
        body: JSON.stringify({
          sessionId: "7ae02f",
          runId: "initial",
          hypothesisId: "H2_SERVER_REJECTION",
          location: "RiderProductRideDetail.tsx:99",
          message: "Rider product action RPC error",
          data: { rpcName, error: e instanceof Error ? e.message : String(e ?? "") },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      toast.error(riderActionErrorMessage(e, "Could not update ride booking"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-400" aria-hidden />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center text-slate-400">
        <p>Ride booking not found.</p>
        <Link to="/rider" className="mt-4 inline-block text-emerald-400 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const st = String(row.status || "").toLowerCase();
  const isMine = row.assigned_rider_id === uid;
  const canAccept = isMine && st === "assigned";
  const canStartRide = isMine && st === "accepted";
  const canDeliver = isMine && st === "en_route";

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
      body: JSON.stringify({
        sessionId: "7ae02f",
        runId: "initial",
        hypothesisId: "H1_UI_GATE_MISMATCH",
        location: "RiderProductRideDetail.tsx:131",
        message: "Rider product action gates evaluated",
        data: { hasBooking: Boolean(row?.id), status: st, isMine, canAccept, canStartRide, canDeliver },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [row?.id, st, isMine, canAccept, canStartRide, canDeliver]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/rider"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-white">Product ride booking</h1>
          <p className="truncate font-mono text-xs text-slate-500">{row.id}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-500">Status</p>
        <p className="text-lg font-semibold text-emerald-300">{statusLabel(row.status)}</p>
        <p className="mt-3 text-xs text-slate-400">Pickup</p>
        <p className="text-sm text-slate-200">{row.pickup_address}</p>
        <p className="mt-3 text-xs text-slate-400">Dropoff</p>
        <p className="text-sm text-slate-200">{row.dropoff_address}</p>
        <p className="mt-3 text-xs text-slate-400">Contact phone</p>
        <p className="text-sm text-slate-200">{row.contact_phone}</p>
        {row.rider_note ? (
          <>
            <p className="mt-3 text-xs text-slate-400">Note</p>
            <p className="text-sm text-slate-200">{row.rider_note}</p>
          </>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status timeline</p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
          <li>Assigned: <span className="text-slate-400">{formatTs(row.assigned_at)}</span></li>
          <li>Accepted: <span className="text-slate-400">{formatTs(row.accepted_at)}</span></li>
          <li>En route: <span className="text-slate-400">{formatTs(row.en_route_at)}</span></li>
          <li>Delivered: <span className="text-slate-400">{formatTs(row.delivered_at)}</span></li>
        </ul>
      </div>

      {!isMine ? <p className="mt-3 text-xs text-amber-200/90">This booking is not assigned to your rider account.</p> : null}

      <div className="mt-6 space-y-3">
        {canAccept ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void callAction("rider_accept_product_ride_booking", "Ride booking accepted")}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Accept booking
          </button>
        ) : null}

        {canStartRide ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void callAction("rider_mark_product_ride_en_route", "Marked en route")}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Mark en route
          </button>
        ) : null}

        {canDeliver ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void callAction("rider_mark_product_ride_delivered", "Marked delivered")}
            className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            Mark delivered
          </button>
        ) : null}
      </div>
    </div>
  );
}
