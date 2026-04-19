import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Loader2, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { AuthSocialButtons } from "../../components/auth/AuthSocialButtons";
import { toE164Ng } from "../../utils/phoneE164";
import { authRedirectTo } from "../../utils/authSiteUrl";
import { safeInternalPath } from "../../utils/authSignupValidation";

function stripOAuthCodeFromUrl() {
  if (window.location.pathname !== "/login") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  window.history.replaceState(null, "", url.pathname + url.search);
}

/** Supabase / GoTrue: user must confirm email before password sign-in. */
function isEmailNotConfirmedError(err: AuthError): boolean {
  const code = (err as { code?: string }).code;
  if (code === "email_not_confirmed") return true;
  const m = err.message.toLowerCase();
  return m.includes("email not confirmed") || m.includes("confirm your email");
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [oauthBusy, setOauthBusy] = useState<"google" | "facebook" | null>(null);

  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user) return;
    const next = safeInternalPath(nextParam);
    navigate(next ?? "/", { replace: true });
  }, [session?.user, navigate, nextParam]);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setLoading(true);
      void supabase.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
        setLoading(false);
        if (!exErr) {
          toast.success("You’re signed in.");
          stripOAuthCodeFromUrl();
        } else {
          toast.error("This sign-in link is invalid or expired.");
          setError("Verification failed. Try signing in again.");
          stripOAuthCodeFromUrl();
        }
      });
      return;
    }

    const hash = window.location.hash;
    if (hash && hash.includes("error_description")) {
      const params = new URLSearchParams(hash.slice(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        setError(errorDesc.replace(/\+/g, " "));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } else if (hash && hash.includes("access_token")) {
      toast.success("You’re signed in.");
    }
  }, [searchParams]);

  const safeNext = safeInternalPath(nextParam);
  const oauthRedirect = authRedirectTo(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login");

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setError(null);
    setOauthBusy(provider);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: oauthRedirect,
          ...(provider === "google"
            ? {
                queryParams: {
                  prompt: "select_account",
                  access_type: "offline",
                },
              }
            : {}),
        },
      });
      if (signInError) {
        toast.error(signInError.message);
        setError(signInError.message);
      }
    } finally {
      setOauthBusy(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: pwErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (pwErr) {
      if (isEmailNotConfirmedError(pwErr)) {
        setError("Please confirm your email first.");
        toast.message("Check your inbox for the confirmation link.", { duration: 5000 });
      } else {
        setError(pwErr.message);
      }
      setLoading(false);
    } else {
      const next = safeInternalPath(nextParam);
      navigate(next ?? "/", { replace: true });
    }
  };

  const sendPhoneLoginCode = async () => {
    setError(null);
    const parsed = toE164Ng(phone);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setPhoneBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: parsed.e164,
        options: {
          shouldCreateUser: false,
        },
      });
      if (otpErr) {
        setError(otpErr.message);
        toast.error(otpErr.message);
        return;
      }
      toast.success("Code sent. Enter it below on the next screen.");
      navigate("/verify-otp", {
        state: { phone: parsed.e164, flow: "login" as const },
      });
    } finally {
      setPhoneBusy(false);
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
          <h1 className="mt-2 text-lg font-semibold text-emerald-50">Welcome back</h1>
          <p className="text-sm text-emerald-100/90">Sign in to continue shopping and selling</p>
        </div>

        <motion.div
          className="p-6 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.42, 0, 1, 1] }}
        >
          {error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <AuthSocialButtons
            signInLabels
            onGoogle={() => void handleSocialLogin("google")}
            onFacebook={() => void handleSocialLogin("facebook")}
            busy={oauthBusy}
            disabled={loading}
          />

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider">
              <span className="bg-white px-3 text-gray-400">Or email</span>
            </div>
          </div>

          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#15803d] hover:underline shrink-0">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
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

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm transition-transform duration-200 ease-out hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <button
              type="button"
              onClick={() => {
                setShowPhoneLogin((v) => !v);
                setError(null);
              }}
              className="flex w-full items-center justify-center gap-2 text-sm font-bold text-gray-800"
            >
              <Smartphone className="h-4 w-4 text-[#15803d]" />
              Sign in with phone
            </button>

            {showPhoneLogin ? (
              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0803 123 4567"
                  autoComplete="tel"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                />
                <button
                  type="button"
                  onClick={() => void sendPhoneLoginCode()}
                  disabled={phoneBusy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#22c55e] py-3 text-sm font-bold text-[#15803d] transition-transform duration-200 ease-out hover:scale-[1.02] hover:bg-[#f0fdf4] active:scale-[0.98] disabled:opacity-50"
                >
                  {phoneBusy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : "Send code"}
                </button>
                <p className="text-center text-[11px] text-gray-500">We’ll open the code entry screen next.</p>
              </div>
            ) : null}
          </div>

          <p className="mt-8 text-center text-sm text-gray-600">
            New to GreenHub?{" "}
            <Link to="/register" className="font-bold text-[#15803d] hover:underline">
              Create account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
