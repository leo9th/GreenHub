import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { maskPhoneE164 } from "../../utils/phoneE164";

const OTP_LEN = 6;

type LocationState = {
  phone?: string;
  flow?: "signup" | "login";
};

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const phone = state.phone?.trim() ?? "";
  const flow: "signup" | "login" = state.flow === "login" ? "login" : "signup";

  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LEN).fill(""));
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) {
      toast.error("Start again from sign in or sign up.");
      navigate("/login", { replace: true });
    }
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  /** Start cooldown after sending OTP (also call on mount if we arrived fresh from send). */
  const startCooldown = useCallback(() => setCountdown(60), []);

  useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  const codeString = otp.join("");

  const verifyAndFinish = async (code: string) => {
    if (!phone || code.length !== OTP_LEN) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.error("Verification incomplete. Try again.");
        return;
      }
      toast.success(flow === "signup" ? "Phone verified." : "Signed in.");
      if (flow === "signup") {
        navigate("/complete-profile", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
    if (v && index < OTP_LEN - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    const joined = next.join("");
    if (joined.length === OTP_LEN && next.every((d) => d !== "")) {
      void verifyAndFinish(joined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (raw.length < OTP_LEN) return;
    const next = raw.split("");
    setOtp(next);
    inputRefs.current[OTP_LEN - 1]?.focus();
    void verifyAndFinish(raw);
  };

  const handleResend = async () => {
    if (!phone || countdown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: flow === "signup",
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("New code sent.");
      startCooldown();
      setOtp(Array(OTP_LEN).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setResending(false);
    }
  };

  if (!phone) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] via-white to-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/60">
        <button
          type="button"
          onClick={() => navigate(flow === "signup" ? "/register" : "/login")}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#22c55e]/10 text-2xl">
          📱
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900">Enter verification code</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          {flow === "signup" ? "Finish signing up." : "Sign in."} We sent a {OTP_LEN}-digit code to
        </p>
        <p className="mt-1 text-center text-sm font-semibold text-gray-900">{maskPhoneE164(phone)}</p>

        <div className="mt-8" onPaste={handlePaste}>
          <div className="flex justify-center gap-2 sm:gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="h-12 w-10 rounded-xl border-2 border-gray-200 text-center text-xl font-bold text-gray-900 shadow-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/25 sm:h-14 sm:w-11 sm:text-2xl"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void verifyAndFinish(codeString)}
          disabled={verifying || codeString.length !== OTP_LEN}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {verifying ? "Verifying…" : "Verify"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-600">
          Didn&apos;t receive a code?{" "}
          {countdown > 0 ? (
            <span className="text-gray-400">Resend in {countdown}s</span>
          ) : (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="font-semibold text-[#15803d] hover:underline disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </p>

        <p className="mt-4 text-center text-sm">
          <Link to={flow === "signup" ? "/register" : "/login"} className="font-medium text-[#15803d] hover:underline">
            Use a different number
          </Link>
        </p>
      </div>
    </div>
  );
}
