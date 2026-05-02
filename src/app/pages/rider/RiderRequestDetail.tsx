import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "@/app/icons/emojiLucide";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { DeclineButton } from "../../components/rider/DeclineButton";
import { riderActionErrorMessage } from "../../utils/riderActionErrors";

type DeliveryJobRow = {
  id: string;
  order_id: string;
  status: string;
  assigned_rider_id: string | null;
  buyer_pin: string;
};

export default function RiderRequestDetail() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const [row, setRow] = useState<DeliveryJobRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");

  const uid = user?.id?.trim() ?? "";
  const jobId = requestId?.trim() ?? "";

  const load = useCallback(async () => {
    if (!jobId) {
      setRow(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("delivery_jobs")
        .select("id, order_id, status, assigned_rider_id, buyer_pin")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      const r = (data as DeliveryJobRow) ?? null;
      setRow(r);
      if (!r) setLoadError("Job not found.");
    } catch (e: unknown) {
      console.error("[RiderRequestDetail] load", e);
      setRow(null);
      setLoadError(e instanceof Error ? e.message : "Could not load this job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (next: "arrived_pickup" | "picked_up" | "en_route" | "delivered") => {
    if (!jobId) return;
    setBusy(true);
    try {
      const args: { p_job_id: string; p_next_status: string; p_buyer_pin?: string } = {
        p_job_id: jobId,
        p_next_status: next,
      };
      if (next === "delivered") {
        args.p_buyer_pin = pin.trim();
      }
      const { error } = await supabase.rpc("rider_advance_delivery_job", args);
      if (error) throw error;
      toast.success("Updated");
      if (next === "delivered") setPin("");
      await load();
    } catch (e: unknown) {
      toast.error(riderActionErrorMessage(e, "Could not update"));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!jobId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("rider_accept_delivery_job", { p_job_id: jobId });
      if (error) throw error;
      toast.success("Job accepted");
      await load();
    } catch (e: unknown) {
      toast.error(riderActionErrorMessage(e, "Could not accept"));
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
        <p>{loadError ?? "Delivery job not found."}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
          <Link to="/rider" className="inline-block text-emerald-400 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const st = String(row.status || "").toLowerCase();
  const isMine = row.assigned_rider_id === uid;
  const canAccept = st === "assigned" && isMine;
  const canDecline = canAccept;

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
          <h1 className="truncate text-lg font-bold text-white">GreenHub delivery</h1>
          <p className="truncate font-mono text-xs text-slate-500">{row.id}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-500">Status</p>
        <p className="text-lg font-semibold capitalize text-emerald-300">{st || "—"}</p>
        <p className="mt-1 text-xs text-slate-500">Order {row.order_id}</p>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Rider GPS pings are not wired to GreenHub jobs yet; keep this page open for job actions only.
      </p>

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
            type="delivery_job"
            id={jobId}
            onDeclined={() =>
              setRow((prev) =>
                prev
                  ? {
                      ...prev,
                      status: "pending_dispatch",
                      assigned_rider_id: null,
                    }
                  : prev,
              )
            }
          />
        ) : null}

        {isMine && st === "accepted" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance("arrived_pickup")}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Arrived at pickup
          </button>
        ) : null}

        {isMine && st === "arrived_pickup" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance("picked_up")}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Confirm picked up
          </button>
        ) : null}

        {isMine && st === "picked_up" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance("en_route")}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Start delivery (en route)
          </button>
        ) : null}

        {isMine && st === "en_route" ? (
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
              onClick={() => void advance("delivered")}
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
