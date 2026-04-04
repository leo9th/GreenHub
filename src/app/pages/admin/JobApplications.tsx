import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export type JobApplicationReviewStatus = "pending" | "approved" | "rejected";

export type JobApplicationRow = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  id_document_front_storage_path: string | null;
  id_document_back_storage_path: string | null;
  id_selfie_storage_path: string | null;
  education_level: string;
  years_experience: number;
  skills: string;
  previous_job_title: string;
  previous_company: string | null;
  cv_storage_path: string | null;
  portfolio_url: string | null;
  desired_job_category: string;
  desired_location: string;
  expected_salary_range: string;
  available_start_date: string;
  bio: string;
  why_greenhub: string;
  review_status: JobApplicationReviewStatus | string | null;
  admin_review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const BUCKET = "job-application-uploads";

function statusBadge(status: string | null | undefined) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800";
  if (s === "rejected") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export default function AdminJobApplications() {
  const [rows, setRows] = useState<JobApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | JobApplicationReviewStatus>("pending");
  const [selected, setSelected] = useState<JobApplicationRow | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const q = supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as JobApplicationRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    const s = (r.review_status || "pending").toLowerCase();
    return s === filter;
  });

  const openSigned = async (path: string | null, label: string) => {
    if (!path) {
      toast.error("No file for " + label);
      return;
    }
    if (urlCache[path]) {
      window.open(urlCache[path], "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Could not open file");
      return;
    }
    setUrlCache((c) => ({ ...c, [path]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const applyReview = async (status: JobApplicationReviewStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const { error } = await supabase
        .from("job_applications")
        .update({
          review_status: status,
          admin_review_notes: notes.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: uid,
        })
        .eq("id", selected.id);

      if (error) throw new Error(error.message);
      toast.success(status === "approved" ? "Application approved." : "Application rejected.");
      setSelected(null);
      setNotes("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-4 max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 text-gray-600 hover:text-[#16a34a]" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Job applications</h1>
            <p className="text-sm text-gray-600">Review submissions from /apply (sign in required)</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                filter === f ? "bg-[#22c55e] text-white" : "bg-white border border-gray-200 text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-600 text-sm">No applications in this filter.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Name</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Category</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                    <th className="text-right p-3 font-semibold text-gray-700"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-medium text-gray-900">{r.full_name}</td>
                      <td className="p-3 text-gray-700">{r.desired_job_category}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(r.review_status)}`}>
                          {r.review_status || "pending"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(r);
                            setNotes(r.admin_review_notes || "");
                          }}
                          className="text-[#16a34a] font-semibold hover:underline"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-app-review-title"
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-start gap-2">
              <div>
                <h2 id="job-app-review-title" className="text-lg font-bold text-gray-900">
                  {selected.full_name}
                </h2>
                <p className="text-xs text-gray-500 mt-1">{selected.email} · {selected.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-800 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <p>
                <span className="text-gray-500">DOB:</span> {selected.date_of_birth} ·{" "}
                <span className="text-gray-500">Gender:</span> {selected.gender}
              </p>
              <p>
                <span className="text-gray-500">Role interest:</span> {selected.desired_job_category} @ {selected.desired_location}
              </p>
              <p>
                <span className="text-gray-500">Salary:</span> {selected.expected_salary_range}
              </p>
              <p className="text-gray-700">{selected.bio.slice(0, 200)}{selected.bio.length > 200 ? "…" : ""}</p>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void openSigned(selected.id_document_front_storage_path, "ID front")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
                >
                  ID front <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void openSigned(selected.id_document_back_storage_path, "ID back")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
                >
                  ID back <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void openSigned(selected.id_selfie_storage_path, "Selfie with ID")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
                >
                  Selfie + ID <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void openSigned(selected.cv_storage_path, "CV")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
                >
                  CV <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">Internal notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Reason for rejection or notes for team…"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void applyReview("approved")}
                  className="px-4 py-2 rounded-lg bg-[#22c55e] text-white font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void applyReview("rejected")}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void applyReview("pending")}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50"
                >
                  Mark pending
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
