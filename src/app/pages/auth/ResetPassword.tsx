import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkReady, setLinkReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error_description")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        setError(errorDesc.replace(/\+/g, " "));
      }
      return;
    }

    const code = searchParams.get("code");
    if (code) {
      setExchangeBusy(true);
      void supabase.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
        setExchangeBusy(false);
        if (exErr) {
          setError("This reset link has expired or is invalid. Please request a new one from the login page.");
        } else {
          setLinkReady(true);
          void navigate("/reset-password", { replace: true });
        }
      });
      return;
    }

    setLinkReady(true);
  }, [searchParams, navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitBusy(true);
    setError(null);

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
    });

    setSubmitBusy(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    toast.success("Password updated. Sign in with your new password.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (exchangeBusy) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#ecfdf5] via-white to-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#15803d]" aria-label="Loading" />
        <p className="mt-4 text-sm text-gray-600">Verifying your reset link…</p>
      </div>
    );
  }

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
          <h1 className="mt-2 text-lg font-semibold text-emerald-50">Set a new password</h1>
          <p className="text-sm text-emerald-100/90">Choose a strong password for your account</p>
        </div>

        <div className="p-6 md:p-8">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {!linkReady && !error ? (
            <p className="text-center text-sm text-gray-600">Preparing secure session…</p>
          ) : null}

          <form onSubmit={(e) => void handleUpdatePassword(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                  disabled={!linkReady || !!error}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 disabled:bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm new password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                disabled={!linkReady || !!error}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 disabled:bg-gray-50"
              />
            </div>

            <button
              type="submit"
              disabled={submitBusy || !linkReady || !!error}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#166534] disabled:opacity-60"
            >
              {submitBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Update password
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            <Link to="/login" className="font-bold text-[#15803d] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
