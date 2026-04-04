import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, MapPin, Phone, Search } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import WorkersSectionHeader from "../../components/workers/WorkersSectionHeader";
import { WORKER_TRADE_CATEGORIES } from "../../data/workerProfileConstants";
import type { WorkerProfileRow } from "../../types/workerProfile";

export default function WorkersBrowse() {
  const [rows, setRows] = useState<WorkerProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled) {
        if (error) {
          console.error(error);
          toast.error("Could not load profiles.");
          setRows([]);
        } else {
          setRows((data as WorkerProfileRow[]) ?? []);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (trade && r.trade_category !== trade) return false;
      if (!term) return true;
      const blob =
        `${r.headline} ${r.skills_summary} ${r.city_state} ${r.full_name} ${r.trade_category}`.toLowerCase();
      return blob.includes(term);
    });
  }, [rows, q, trade]);

  return (
    <div className="min-h-screen bg-[#f8faf8] pb-20">
      <WorkersSectionHeader />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-600 mb-6 max-w-3xl">
          Use the search and filters below to find artisans or workers you can employ. Open a profile to call,
          email, or WhatsApp them—your arrangement is between you and them.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills, role, name, location…"
              className="w-full rounded-lg border border-gray-200 pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#22c55e] outline-none"
            />
          </div>
          <label className="block text-xs font-medium text-gray-500">
            Type of work
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm md:max-w-md"
            >
              <option value="">All categories</option>
              {WORKER_TRADE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-[#166534]">
            <Loader2 className="w-10 h-10 animate-spin" aria-label="Loading" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-16 bg-white rounded-xl border border-dashed border-gray-200">
            No profiles match your filters yet.{" "}
            <Link to="/workers/register" className="text-[#166534] font-semibold hover:underline">
              Be the first to list yourself
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((w) => (
              <li key={w.id}>
                <article className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm hover:border-[#86efac] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-[#166534]">{w.trade_category}</p>
                      <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                        <Link to={`/workers/${w.id}`} className="hover:text-[#14532d]">
                          {w.full_name}
                        </Link>
                      </h2>
                      <p className="text-gray-800 font-medium mt-1">{w.headline}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{w.skills_summary}</p>
                      <p className="text-sm text-gray-600 mt-2 inline-flex items-center gap-1">
                        <MapPin className="w-4 h-4 shrink-0 text-gray-400" aria-hidden />
                        {w.city_state}
                        {w.years_experience != null && (
                          <span className="text-gray-500"> · ~{w.years_experience} yrs experience</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        to={`/workers/${w.id}`}
                        className="inline-flex justify-center rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-bold text-white hover:bg-[#16a34a]"
                      >
                        View profile
                      </Link>
                      <a
                        href={`tel:${w.phone.replace(/\s/g, "")}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        <Phone className="w-4 h-4" aria-hidden />
                        Call
                      </a>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
