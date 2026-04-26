import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { DeclineButton } from "../../components/rider/DeclineButton";
import { riderActionErrorMessage } from "../../utils/riderActionErrors";

type RequestRow = {
  id: string;
  order_id: string;
  status: string | null;
  assigned_rider_id: string | null;
  delivery_pin: string | null;
};

const ACTIVE_FOR_GPS = new Set(["assigned", "picked_up"]);

export default function RiderRequestDetail() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const [row, setRow] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uid = user?.id?.trim() ?? "";
  const rid = requestId?.trim() ?? "";

  const load = useCallback(async () => {
    if (!rid) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("delivery_requests").select("id, order_id, status, assigned_rider_id, delivery_pin").eq("id", rid).maybeSingle();
      if (error) throw error;
      setRow((data as RequestRow) ?? null);
    } catch (e: unknown) {
      console.error(e);
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!rid) return;
      try {
        const { error } = await supabase.rpc("rider_record_delivery_tracking", {
          p_request_id: rid,
          p_latitude: lat,
          p_longitude: lng,
        });
        if (error) throw error;
      } catch (e: unknown) {
        console.warn("[RiderRequestDetail] tracking", e);
      }
    },
    [rid],
  );

  useEffect(() => {
    if (!row || !uid) return;
    const st = String(row.status || "").toLowerCase();
    const isMine = row.assigned_rider_id === uid;
    if (!isMine || !ACTIVE_FOR_GPS.has(st)) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (typeof navigator.geolocation === "undefined") {
      setGeoHint("Geolocation is not available in this browser.");
      return;
    }

    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => setGeoHint(err.message || "Location error"),
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
      );
    };

    void tick();
    intervalRef.current = setInterval(tick, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [row, uid, sendLocation]);

  const accept = async () => {
    if (!rid) return;
    setBusy(true);
    // #region agent log
    fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
      body: JSON.stringify({
        sessionId: "7ae02f",
        runId: "initial",
        hypothesisId: "H3_DELIVERY_STATE_OR_ASSIGNMENT",
        location: "RiderRequestDetail.tsx:113",
        message: "Delivery accept RPC attempt",
        data: { hasRequestId: Boolean(rid), statusBefore: String(row?.status || "").toLowerCase(), isMine: row?.assigned_rider_id === uid },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const { error } = await supabase.rpc("rider_accept_delivery_request", { p_request_id: rid });
      if (error) throw error;
      toast.success("Job accepted");
      await load();
    } catch (e: unknown) {
      // #region agent log
      fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
        body: JSON.stringify({
          sessionId: "7ae02f",
          runId: "initial",
          hypothesisId: "H3_DELIVERY_STATE_OR_ASSIGNMENT",
          location: "RiderRequestDetail.tsx:129",
          message: "Delivery accept RPC error",
          data: { error: e instanceof Error ? e.message : String(e ?? "") },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      toast.error(riderActionErrorMessage(e, "Could not accept"));
    } finally {
      setBusy(false);
    }
  };

  const pickedUp = async () => {
    if (!rid) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("rider_mark_delivery_picked_up", { p_request_id: rid });
      if (error) throw error;
      toast.success("Marked picked up");
      await load();
    } catch (e: unknown) {
      toast.error(riderActionErrorMessage(e, "Could not update"));
    } finally {
      setBusy(false);
    }
  };

  const delivered = async () => {
    if (!rid) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("rider_mark_delivery_delivered", {
        p_request_id: rid,
        p_pin: pin.trim(),
      });
      if (error) throw error;
      toast.success("Delivered");
      setPin("");
      await load();
    } catch (e: unknown) {
      toast.error(riderActionErrorMessage(e, "Could not complete"));
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
        <p>Request not found.</p>
        <Link to="/rider" className="mt-4 inline-block text-emerald-400 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const st = String(row.status || "").toLowerCase();
  const isMine = row.assigned_rider_id === uid;
  const canAccept = st === "pending" && !row.assigned_rider_id;
  const canDecline = isMine && st === "assigned";

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7794/ingest/f13b5b2f-8e47-4c0e-b6dd-9881ab34f9db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7ae02f" },
      body: JSON.stringify({
        sessionId: "7ae02f",
        runId: "initial",
        hypothesisId: "H4_STALE_OR_MISMATCHED_VIEW_STATE",
        location: "RiderRequestDetail.tsx:199",
        message: "Delivery detail state evaluated",
        data: { hasRequest: Boolean(row?.id), status: st, isMine, canAccept, canDecline, hasAssignedRider: Boolean(row?.assigned_rider_id) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [row?.id, st, isMine, canAccept, canDecline, row?.assigned_rider_id]);

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
          <h1 className="truncate text-lg font-bold text-white">Delivery request</h1>
          <p className="truncate font-mono text-xs text-slate-500">{row.id}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-500">Status</p>
        <p className="text-lg font-semibold capitalize text-emerald-300">{st || "—"}</p>
        <p className="mt-1 text-xs text-slate-500">Order {row.order_id}</p>
      </div>

      {geoHint ? <p className="mt-3 text-xs text-amber-200/90">{geoHint}</p> : null}
      {isMine && ACTIVE_FOR_GPS.has(st) ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Sending location about every 15s while this page is open.
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {canAccept ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void accept()}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              Accept job
            </button>
          </div>
        ) : null}

        {canDecline ? (
          <DeclineButton
            type="delivery_request"
            id={rid}
            onDeclined={() =>
              setRow((prev) =>
                prev
                  ? {
                      ...prev,
                      status: "rejected",
                      assigned_rider_id: null,
                    }
                  : prev,
              )
            }
          />
        ) : null}

        {isMine && st === "assigned" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pickedUp()}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Mark picked up
          </button>
        ) : null}

        {isMine && st === "picked_up" ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400" htmlFor="pin-del">
              Buyer PIN (from their order page)
            </label>
            <input
              id="pin-del"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
              placeholder="••••••"
            />
            <button
              type="button"
              disabled={busy || pin.length !== 6}
              onClick={() => void delivered()}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Mark delivered
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
