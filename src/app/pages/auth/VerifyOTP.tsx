import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { maskPhoneE164 } from "../../utils/phoneE164";
import { useNotification } from "../../context/NotificationProvider";

const OTP_LEN = 6;

type LocationState = {
  phone?: string;
  flow?: "signup" | "login";
};
type PendingSignup = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  createdAt: number;
};
const SIGNUP_PENDING_STORAGE_KEY = "greenhub.pendingSignup";
const SIGNUP_PENDING_MAX_AGE_MS = 30 * 60 * 1000;

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const notif = useNotification();
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
      notif.error("Session Error", "Start again from sign in or sign up.");
      navigate("/login", { replace: true });
    }
  }, [phone, navigate, notif]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const startCooldown = useCallback(() => setCountdown(60), []);

  useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  const codeString = otp.join("");

  const readPendingSignup = (): PendingSignup | null => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_PENDING_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingSignup;
      const age = Date.now() - Number(parsed.createdAt || 0);
      if (
        !parsed.email ||
        !parsed.password ||
        !parsed.phone ||
        !Number.isFinite(age) ||
        age > SIGNUP_PENDING_MAX_AGE_MS
      ) {
        sessionStorage.removeItem(SIGNUP_PENDING_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      sessionStorage.removeItem(SIGNUP_PENDING_STORAGE_KEY);
      return null;
    }
  };

  const clearPendingSignup = () => {
    sessionStorage.removeItem(SIGNUP_PENDING_STORAGE_KEY);
  };

  const completeSignupFromPending = async (verifiedPhone: string) => {
    const pending = readPendingSignup();
    if (!pending || pending.phone !== verifiedPhone) {
      throw new Error("Signup session expired. Please start signup again.");
    }

    const { error: updateAuthError } = await supabase.auth.updateUser({
      email: pending.email,
      password: pending.password,
      data: {
        ...(pending.fullName ? { full_name: pending.fullName } : {}),
        phone: verifiedPhone,
        role: "buyer",
      },
    });
    if (updateAuthError) throw new Error(updateAuthError.message);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) throw new Error("Could not finalize signup. Please sign in again.");

    const { error: profileErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: pending.fullName || null,
        email: pending.email,
        phone: verifiedPhone,
        phone_verified: true,
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    clearPendingSignup();
  };

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
        notif.authError("Verification Failed", error.message);
        return;
      }
      if (!data.session) {
        notif.error("Verification Incomplete", "Try again.");
        return;
      }
      if (flow === "signup") {
        await completeSignupFromPending(phone);
        notif.success("Phone Verified", "Signup completed successfully.");
        navigate("/welcome", { replace: true });
      } else {
        notif.success("Signed In Successfully");
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
          shouldCreateUser: true,
        },
      });
      if (error) {
        notif.error("Resend Failed", error.message);
        return;
      }
      notif.success("Code Sent", "New verification code sent to your phone.");
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

        <div className="mt-8 space-y-4">
          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                {countdown}
              </div>
              <span className="text-sm font-medium text-blue-900">Resend code available in {countdown}s</span>
            </div>
          )}
          <p className="text-center text-sm text-gray-600">
            Didn&apos;t receive a code?{" "}
            {countdown > 0 ? (
              <span className="text-gray-400">Wait for the timer above</span>
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
        </div>

        <p className="mt-4 text-center text-sm">
          <Link to={flow === "signup" ? "/register" : "/login"} className="font-medium text-[#15803d] hover:underline">
            Use a different number
          </Link>
        </p>
      </div>
    </div>
  );
}