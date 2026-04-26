import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { riderActionErrorMessage } from "../../utils/riderActionErrors";

interface DeclineButtonProps {
  type: "delivery_request" | "product_ride_booking";
  id: string;
  onDeclined?: () => void;
  variant?: "button" | "icon";
}

export function DeclineButton({
  type,
  id,
  onDeclined,
  variant = "button",
}: DeclineButtonProps) {
  const [isDeclining, setIsDeclining] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      if (type === "delivery_request") {
        const { error } = await supabase.rpc("rider_decline_delivery_request", {
          p_request_id: id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("rider_decline_product_ride_booking", {
          p_booking_id: id,
        });
        if (error) throw error;
      }

      toast.success("Delivery declined");
      onDeclined?.();
    } catch (e: unknown) {
      toast.error(riderActionErrorMessage(e, "Could not decline delivery"));
    } finally {
      setIsDeclining(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isDeclining}
          className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/50 disabled:opacity-60"
        >
          {isDeclining ? "Declining..." : "Decline"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isDeclining}
          className="text-rose-300 hover:text-rose-200 disabled:opacity-60"
          title="Decline"
        >
          ✕
        </button>
      )}

      {showConfirm ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-slate-900">
            <h3 className="text-lg font-semibold">Decline Delivery?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Decline this delivery? This cannot be undone.
            </p>
            <p className="mt-1 text-sm text-slate-600">The job will be offered to other riders.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isDeclining}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDecline()}
                disabled={isDeclining}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Yes, Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

