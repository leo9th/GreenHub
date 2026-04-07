import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin}/reset-password`,
    });

    setLoading(false);

    if (resetErr) {
      setError(resetErr.message);
    } else {
      setSuccess(true);
      toast.success("If an account exists for that email, we sent reset instructions.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ecfdf5] via-white to-gray-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50">
        <div className="border-b border-gray-100 bg-[#15803d] px-6 py-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <span className="text-2xl" aria-hidden>
              🌿
            </span>
            GreenHub
          </Link>
          <h1 className="mt-2 text-lg font-semibold text-emerald-50">Reset your password</h1>
          <p className="text-sm text-emerald-100/90">Enter your account email and we’ll send a secure link</p>
        </div>

        <div className="p-6 md:p-8">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-900">
              <p className="font-medium">Check your email</p>
              <p className="mt-1 text-emerald-800/90">
                We sent a password reset link to <span className="font-semibold break-all">{email.trim()}</span>. Open
                it to choose a new password. If nothing arrives within a few minutes, check spam or try again.
              </p>
            </div>
          ) : null}

          <form onSubmit={(e) => void handleReset(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={success}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 disabled:bg-gray-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#166534] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Send reset link
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Remember your password?{" "}
            <Link to="/login" className="font-bold text-[#15803d] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
