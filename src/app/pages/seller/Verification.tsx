import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ShieldCheck, Upload, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const BUCKET = "seller-verification";

const ID_TYPES = [
  { value: "nin" as const, label: "NIN (National Identification Number)" },
  { value: "drivers_license" as const, label: "Driver's License" },
  { value: "passport" as const, label: "International Passport" },
];

type IdType = (typeof ID_TYPES)[number]["value"];

type VerificationRow = {
  id_type: string;
  status: string;
  storage_path: string;
  created_at: string;
  rejection_reason: string | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

export default function SellerVerification() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [idType, setIdType] = useState<IdType>("nin");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const { data, error: qErr } = await supabase
      .from("seller_verification")
      .select("id_type, status, storage_path, created_at, rejection_reason")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (qErr) {
      console.error(qErr);
      setRows([]);
    } else {
      setRows((data ?? []) as VerificationRow[]);
    }
    setLoadingList(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      navigate("/login", { replace: true });
      return;
    }
    void loadRecords();
  }, [authLoading, user?.id, navigate, loadRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user?.id || !file) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File must be 8MB or smaller.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
      setError("Use JPG, PNG, WebP, or PDF.");
      return;
    }

    setSubmitting(true);
    try {
      const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from("seller_verification").upsert(
        {
          seller_id: user.id,
          id_type: idType,
          storage_path: objectPath,
          file_name: file.name,
          mime_type: file.type || null,
          status: "pending",
          updated_at: new Date().toISOString(),
          rejection_reason: null,
        },
        { onConflict: "seller_id,id_type" }
      );

      if (rowErr) throw rowErr;

      setFile(null);
      await loadRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Check Storage policies and the seller_verification table.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-800 bg-green-100 px-2 py-1 rounded">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
        </span>
      );
    if (s === "rejected")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 bg-red-100 px-2 py-1 rounded">
          <XCircle className="h-3.5 w-3.5" /> Rejected
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-100 px-2 py-1 rounded">
        <Clock className="h-3.5 w-3.5" /> Pending review
      </span>
    );
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f4f8]">
        <Loader2 className="h-10 w-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Verification</h1>
            <p className="text-xs text-gray-500">Valid government ID (NIN, driver&apos;s license, or passport)</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
          <ShieldCheck className="w-10 h-10 text-blue-600 shrink-0" />
          <div className="text-sm text-blue-950">
            <p className="font-semibold mb-1">Why we ask</p>
            <p className="text-blue-900/90">
              Uploads are stored in a private bucket and used only for verification. Do not upload passwords or unrelated files.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">ID type</label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value as IdType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#22c55e] focus:outline-none"
            >
              {ID_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">Document file</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-10 px-4 cursor-pointer hover:border-[#22c55e]/50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 text-center">{file ? file.name : "JPG, PNG, WebP, or PDF — max 8MB"}</span>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(ev) => {
                  setError(null);
                  setFile(ev.target.files?.[0] ?? null);
                }}
              />
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting || !file}
            className="w-full py-3 rounded-xl bg-[#22c55e] text-white font-bold text-sm hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
          >
            {submitting ? "Uploading…" : "Submit for review"}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Your submissions</h2>
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#22c55e]" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={`${r.id_type}-${r.storage_path}`} className="border border-gray-100 rounded-lg p-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{r.id_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                    {r.status?.toLowerCase() === "rejected" && r.rejection_reason ? (
                      <p className="text-xs text-red-600 mt-2">{r.rejection_reason}</p>
                    ) : null}
                  </div>
                  {statusBadge(r.status)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
