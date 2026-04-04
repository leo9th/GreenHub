import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { ArrowLeft, Eye, EyeOff, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { decryptJobIdNumber } from "../../utils/jobIdCrypto";
import { toast } from "sonner";

type JobRow = Record<string, unknown>;

const BUCKET = "job-application-uploads";

export default function AdminJobApplications() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as JobRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: JobRow) => {
    setSelected(row);
    setRejectNotes(String((row as { verification_notes?: string }).verification_notes ?? ""));
    setRevealedId(null);
    setSignedUrls({});
    const paths = {
      front: row.id_front_image as string | undefined,
      back: row.id_back_image as string | undefined,
      selfie: row.selfie_image as string | undefined,
      cv: row.cv_storage_path as string | undefined,
    };
    const next: Record<string, string | null> = {};
    for (const [k, p] of Object.entries(paths)) {
      if (!p) {
        next[k] = null;
        continue;
      }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, 600);
      next[k] = error ? null : data?.signedUrl ?? null;
    }
    setSignedUrls(next);
  };

  const decryptAndReveal = async (row: JobRow) => {
    const ct = row.id_number_ciphertext as string | undefined;
    const iv = row.id_number_iv as string | undefined;
    const plain = row.id_number as string | undefined;
    if (plain) {
      setRevealedId(plain);
      return;
    }
    if (ct && iv) {
      const dec = await decryptJobIdNumber(ct, iv);
      setRevealedId(dec ?? "(cannot decrypt — check VITE_JOB_CRYPTO_KEY)");
      return;
    }
    setRevealedId("(none)");
  };

  const setStatus = async (row: JobRow, status: "approved" | "rejected") => {
    const id = String(row.id);
    setUpdatingId(id);
    try {
      const notes = status === "rejected" ? rejectNotes.trim() : null;
      const { error } = await supabase
        .from("job_applications")
        .update({
          id_verification_status: status,
          id_verified: status === "approved",
          verification_notes: notes,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "approved" ? "Application approved" : "Application rejected");
      const email = String(row.email ?? "");
      if (email) {
        const subject = encodeURIComponent(`GreenHub job application — ${status}`);
        const body = encodeURIComponent(
          status === "approved"
            ? "Your employment application with GreenHub has been approved. Our team will contact you with next steps."
            : `We were unable to approve your employment application at this time.${notes ? `\n\nNote: ${notes}` : ""}\n\nIf you believe this is a mistake, you may reply to this thread.`,
        );
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
      }
      setSelected(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 text-gray-600 hover:text-[#16a34a]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job applications</h1>
            <p className="text-sm text-gray-500">Review ID uploads and approve or reject</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-600 py-12">No applications yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{String(r.full_name ?? "")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(r.email ?? "")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.id_verification_status === "approved"
                            ? "text-green-700 font-medium"
                            : r.id_verification_status === "rejected"
                              ? "text-red-600 font-medium"
                              : "text-amber-700 font-medium"
                        }
                      >
                        {String(r.id_verification_status ?? "pending")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.created_at ? new Date(String(r.created_at)).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(r)}
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
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Application detail</h2>
              <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-medium">{String(selected.full_name)}</p>
              </div>
              <div>
                <span className="text-gray-500">ID type</span>
                <p className="font-medium">{String(selected.id_type)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500">ID number</span>
                <button
                  type="button"
                  onClick={() => void decryptAndReveal(selected)}
                  className="inline-flex items-center gap-1 text-[#16a34a] font-medium text-xs border border-[#22c55e]/40 rounded px-2 py-1"
                >
                  {revealedId ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {revealedId ? "Hide" : "Reveal (admin)"}
                </button>
                {revealedId && <code className="text-xs bg-gray-100 px-2 py-1 rounded">{revealedId}</code>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["front", "back", "selfie"] as const).map((k) => (
                  <a
                    key={k}
                    href={signedUrls[k] ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center text-xs ${
                      signedUrls[k] ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 text-gray-400 pointer-events-none"
                    }`}
                  >
                    <ImageIcon className="w-5 h-5 text-gray-500" />
                    ID {k}
                  </a>
                ))}
              </div>
              {signedUrls.cv && (
                <a
                  href={signedUrls.cv}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[#16a34a] font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Open CV
                </a>
              )}
              <label className="block">
                <span className="text-gray-500">Rejection note (shown in email body if rejected)</span>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  disabled={updatingId != null}
                  onClick={() => void setStatus(selected, "approved")}
                  className="flex-1 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={updatingId != null}
                  onClick={() => void setStatus(selected, "rejected")}
                  className="flex-1 py-2.5 rounded-lg border border-red-300 text-red-700 font-semibold disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Email uses your system mail client (mailto). For automated email, add a Supabase Edge Function with
                Resend/SendGrid.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
