import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "@/app/icons/emojiLucide";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatGreenHubRelative } from "../utils/formatGreenHubTime";

type BookingRow = {
  id: string;
  status: string | null;
  pickup_address: string;
  dropoff_address: string;
  assigned_rider_id: string | null;
  created_at: string | null;
  source: string | null;
};

export default function StandaloneBookingStatus() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user: authUser } = useAuth();
  const [row, setRow] = useState<BookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = bookingId?.trim() ?? "";

  const load = useCallback(async () => {
    if (!id) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("product_ride_bookings")
      .select("id, status, pickup_address, dropoff_address, assigned_rider_id, created_at, source")
      .eq("id", id)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setRow(null);
    } else {
      setRow(data as BookingRow);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !authUser?.id) return;
    const channel = supabase
      .channel(`booking-status:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_ride_bookings", filter: `id=eq.${id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUser?.id, id, load]);

  const statusLabel = useMemo(() => {
    const s = String(row?.status ?? "").toLowerCase();
    if (s === "pending") return "Looking for a rider…";
    if (s === "assigned" || s === "accepted") return "Rider assigned";
    if (s === "en_route") return "Rider on the way";
    if (s === "delivered") return "Delivered";
    if (s === "cancelled") return "Cancelled";
    return row?.status ?? "—";
  }, [row?.status]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg">
        <Link
          to="/home"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#16a34a] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-foreground">Booking status</h1>
          <p className="mt-1 font-mono text-xs text-gray-500 dark:text-muted-foreground">{id || "—"}</p>

          {loading ? (
            <div className="mt-8 flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#22c55e]" />
            </div>
          ) : error ? (
            <p className="mt-6 text-sm text-red-600">{error}</p>
          ) : !row ? (
            <p className="mt-6 text-sm text-gray-600 dark:text-muted-foreground">Booking not found.</p>
          ) : (
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Status</p>
                <p className="mt-1 text-lg font-semibold text-[#15803d] dark:text-emerald-400">{statusLabel}</p>
              </div>
              {row.assigned_rider_id ? (
                <p className="text-xs text-gray-600 dark:text-muted-foreground">
                  Rider reference: <span className="font-mono">{row.assigned_rider_id.slice(0, 8)}…</span>
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Admin dispatch assigns the nearest approved rider when available. You’ll see updates here live.
                </p>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Pickup</p>
                <p className="mt-0.5 text-gray-900 dark:text-foreground">{row.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Drop-off</p>
                <p className="mt-0.5 text-gray-900 dark:text-foreground">{row.dropoff_address}</p>
              </div>
              {row.created_at ? (
                <p className="text-xs text-gray-500 dark:text-muted-foreground">
                  Created {formatGreenHubRelative(row.created_at)}
                </p>
              ) : null}
              {row.source ? (
                <p className="text-xs text-gray-400 dark:text-muted-foreground">Source: {row.source}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/product-rides" className="text-sm font-medium text-[#16a34a] hover:underline">
            View all my ride requests
          </Link>
        </div>
      </div>
    </div>
  );
}
