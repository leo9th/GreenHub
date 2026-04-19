import { useCallback, useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { toE164Ng, maskPhoneE164 } from "../utils/phoneE164";
import { cn } from "./ui/utils";

const OTP_LEN = 6;
const RESEND_COOLDOWN_SEC = 60;

type Props = {
  userId: string;
  /** Called after profile row is updated with phone + phone_verified */
  onVerified: () => void;
  className?: string;
};

/**
 * Post-signup phone verification for logged-in users.
 *
 * Uses `updateUser({ phone })` + `verifyOtp({ type: 'phone_change' })` so the number
 * attaches to the **current** session. Plain `signInWithOtp` is for unauthenticated
 * sign-in flows and would not reliably link an email account to a new phone.
 */
export function PhoneVerification({ userId, onVerified, className }: Props) {
  const [rawPhone, setRawPhone] = useState("");
  const [e164Pending, setE164Pending] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendOtp = useCallback(async () => {
    const parsed = e164Pending ? { e164: e164Pending } : toE164Ng(rawPhone);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: parsed.e164 });
      if (error) {
        toast.error(error.message);
        return;
      }
      setE164Pending(parsed.e164);
      setOtp("");
      setCooldown(RESEND_COOLDOWN_SEC);
      toast.message("Check your phone for the verification code.", { duration: 4000 });
    } finally {
      setSending(false);
    }
  }, [rawPhone, e164Pending]);

  const verifyOtp = useCallback(async () => {
    const code = otp.replace(/\D/g, "").slice(0, OTP_LEN);
    if (!e164Pending || code.length !== OTP_LEN) {
      toast.error("Enter the 6-digit code from SMS.");
      return;
    }
    setVerifying(true);
    try {
      const primary = await supabase.auth.verifyOtp({
        phone: e164Pending,
        token: code,
        type: "phone_change",
      });
      if (primary.error) {
        const fallback = await supabase.auth.verifyOtp({
          phone: e164Pending,
          token: code,
          type: "sms",
        });
        if (fallback.error) {
          toast.error(primary.error.message || "Invalid code.");
          return;
        }
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          phone: e164Pending,
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (upErr) {
        console.warn("profiles phone update:", upErr);
        toast.error("Phone verified, but profile could not be saved. Try again from settings.");
        return;
      }

      toast.success("Phone verified! You can now sell and message others.");
      onVerified();
      setE164Pending(null);
      setOtp("");
      setRawPhone("");
    } finally {
      setVerifying(false);
    }
  }, [e164Pending, otp, userId, onVerified]);

  const showOtpStep = Boolean(e164Pending);

  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm ring-1 ring-emerald-100/60 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-100">
          <Smartphone className="h-5 w-5 text-emerald-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Verify phone number</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Add your Nigerian mobile number. We&apos;ll send a one-time code by SMS — quick, optional, and helps keep the
            marketplace safe.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!showOtpStep ? (
          <>
            <label htmlFor="pv-phone" className="sr-only">
              Phone number
            </label>
            <input
              id="pv-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 0803 123 4567 (+234 added automatically)"
              value={rawPhone}
              onChange={(e) => setRawPhone(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-[15px] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={sending || rawPhone.trim().length < 10}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              Send OTP
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600">
              Code sent to <span className="font-medium text-gray-900">{maskPhoneE164(e164Pending!)}</span>
              <button
                type="button"
                className="ml-2 font-semibold text-emerald-700 hover:underline"
                onClick={() => {
                  setE164Pending(null);
                  setOtp("");
                }}
              >
                Change number
              </button>
            </p>
            <label htmlFor="pv-otp" className="sr-only">
              One-time code
            </label>
            <input
              id="pv-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LEN}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-center font-mono text-lg tracking-[0.35em] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void verifyOtp()}
                disabled={verifying || otp.replace(/\D/g, "").length !== OTP_LEN}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                Verify
              </button>
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={sending || cooldown > 0}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
