import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Truck } from "@/app/icons/emojiLucide";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { formatGreenHubRelative } from "../utils/formatGreenHubTime";

type BookingRow = {
  id: string;
  product_id: string;
  status: string | null;
  pickup_address: string;
  dropoff_address: string;
  assigned_rider_id: string | null;
  created_at: string | null;
};

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const msg = String(e.message ?? "").toLowerCase();
  return e.code === "42P01" || msg.includes("does not exist");
}

export default function ProductRideBookings() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [titlesByProductId, setTitlesByProductId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  const uid = authUser?.id?.trim() ?? "";

  const load = useCallback(async () => {
    if (!uid) {
      setRows([]);
      setTitlesByProductId(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMissingTable(false);
    try {
      const { data, error: qErr } = await supabase
        .from("product_ride_bookings")
        .select("id, product_id, status, pickup_address, dropoff_address, assigned_rider_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (qErr) {
        if (isMissingRelationError(qErr)) {
          setMissingTable(true);
          setRows([]);
          setTitlesByProductId(new Map());
          return;
        }
        throw qErr;
      }

      const list = (data ?? []) as BookingRow[];
      setRows(list);

      const productIds = [...new Set(list.map((r) => String(r.product_id || "").trim()).filter(Boolean))];
      if (productIds.length === 0) {
        setTitlesByProductId(new Map());
        return;
      }

      const { data: prods, error: pErr } = await supabase.from("products").select("id, title").in("id", productIds);
      if (pErr) {
        console.warn("[ProductRideBookings] products select", pErr);
        setTitlesByProductId(new Map());
        return;
      }
      const m = new Map<string, string>();
      for (const p of (prods ?? []) as { id: string; title: string | null }[]) {
        if (p.id) m.set(String(p.id), (p.title || "").trim() || String(p.id));
      }
      setTitlesByProductId(m);
    } catch (e: unknown) {
      console.error("[ProductRideBookings] load failed", e);
      setError(e instanceof Error ? e.message : "Could not load ride bookings");
      setRows([]);
      setTitlesByProductId(new Map());
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true, state: { from: "/product-rides" } });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const empty = useMemo(() => !loading && !error && !missingTable && rows.length === 0, [loading, error, missingTable, rows.length]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate(-1)} className="-ml-2 rounded-lg p-2 text-gray-700 hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">My product ride requests</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {missingTable ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Product ride bookings are not available yet (database table missing). Ask your admin to apply migrations.
          </p>
        ) : null}

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {loading ? (
          <div className="flex justify-center py-16 text-gray-600">
            <Loader2 className="h-9 w-9 animate-spin text-emerald-600" aria-hidden />
          </div>
        ) : empty ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Truck className="h-10 w-10 text-gray-400" aria-hidden />
            </div>
            <h2 className="text-base font-semibold text-gray-900">No ride requests yet</h2>
            <p className="mt-2 text-sm text-gray-600">Book a ride from a product page when GreenHub riders are offered.</p>
            <Link to="/products" className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((b) => {
              const pid = String(b.product_id || "").trim();
              const title = titlesByProductId.get(pid);
              const when = b.created_at ? formatGreenHubRelative(b.created_at) : "—";
              return (
                <li key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Product</p>
                      {pid ? (
                        <Link to={`/products/${encodeURIComponent(pid)}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                          {title || pid}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-700">—</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-800">
                      {(b.status || "—").replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-500">Booking ID</p>
                  <p className="font-mono text-xs text-gray-800">{b.id}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">Pickup</p>
                  <p className="text-sm text-gray-800">{b.pickup_address || "—"}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">Dropoff</p>
                  <p className="text-sm text-gray-800">{b.dropoff_address || "—"}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">Assigned rider</p>
                  <p className="font-mono text-xs text-gray-800">{b.assigned_rider_id ? `${b.assigned_rider_id.slice(0, 8)}…` : "—"}</p>
                  <p className="mt-2 text-xs text-gray-500">Requested {when}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
