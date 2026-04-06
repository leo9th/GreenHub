import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { AuthSocialButtons } from "../../components/auth/AuthSocialButtons";
import { toE164Ng } from "../../utils/phoneE164";

type Step = "choose" | "phone";

const REDIRECT = typeof window !== "undefined" ? window.location.origin : "";

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "facebook" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oauthRedirect = `${REDIRECT}/login`;

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setError(null);
    setOauthBusy(provider);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: oauthRedirect,
        },
      });
      if (signInError) {
        setError(`Could not continue with ${provider}: ${signInError.message}`);
        toast.error(signInError.message);
      }
    } finally {
      setOauthBusy(null);
    }
  };

  const sendPhoneSignupCode = async () => {
    setError(null);
    const parsed = toE164Ng(phone);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: parsed.e164,
        options: {
          shouldCreateUser: true,
        },
      });
      if (otpErr) {
        setError(otpErr.message);
        toast.error(otpErr.message);
        return;
      }
      toast.success("Check your phone for the verification code.");
      navigate("/verify-otp", {
        replace: true,
        state: { phone: parsed.e164, flow: "signup" as const },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ecfdf5] via-white to-gray-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
        {step === "choose" ? (
          <div className="border-b border-gray-100 bg-[#15803d] px-6 py-5 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <span className="text-2xl" aria-hidden>
                🌿
              </span>
              GreenHub
            </Link>
            <p className="mt-1 text-sm text-emerald-100">Create your account</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setError(null);
              }}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Phone number</h1>
              <p className="text-xs text-gray-500">We’ll text you a code to confirm.</p>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8">
          {step === "choose" ? (
            <div>
              <AuthSocialButtons
                onGoogle={() => void handleSocialLogin("google")}
                onFacebook={() => void handleSocialLogin("facebook")}
                busy={oauthBusy}
              />

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider">
                  <span className="bg-white px-3 text-gray-400">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep("phone")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-900/10 hover:bg-[#166534]"
              >
                <Smartphone className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
                Register with Phone
              </button>

              <p className="mt-8 text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-[#15803d] hover:underline">
                  Sign in
                </Link>
              </p>

              <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
                By continuing you agree to our{" "}
                <Link to="/terms" className="underline hover:text-gray-600">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline hover:text-gray-600">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          ) : (
            <div>
              {error ? (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <label className="mb-2 block text-sm font-medium text-gray-700">Mobile number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
                autoComplete="tel"
                className="mb-6 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              />
              <button
                type="button"
                onClick={() => void sendPhoneSignupCode()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white hover:bg-[#166534] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Send verification code
              </button>
              <p className="mt-4 text-center text-xs text-gray-500">
                SMS delivery requires Phone provider enabled in Supabase (Auth → Providers → Phone).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
