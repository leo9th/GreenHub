import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, Smartphone, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { AuthSocialButtons } from "../../components/auth/AuthSocialButtons";
import { toE164Ng } from "../../utils/phoneE164";
import { authRedirectTo } from "../../utils/authSiteUrl";
import {
  getPasswordStrength,
  isValidEmailFormat,
  mapSignUpErrorToToast,
  passwordMeetsRequirements,
} from "../../utils/authSignupValidation";
import { cn } from "../../components/ui/utils";

type Step = "email" | "phone";

const FORM_ID = "greenhub-signup-form";
const SIGNUP_PENDING_STORAGE_KEY = "greenhub.pendingSignup";

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "facebook" | null>(null);

  const oauthRedirect = authRedirectTo("/login?next=/welcome");

  const emailOk = useMemo(() => isValidEmailFormat(email), [email]);
  const emailTouched = email.length > 0;
  const pwdStrength = useMemo(() => getPasswordStrength(password), [password]);
  const pwdOk = passwordMeetsRequirements(password);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  const handleSocialLogin = async (provider: "google" | "facebook") => {
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
      } else {
        toast.message("Redirecting to Google…", { duration: 2500 });
      }
    } finally {
      setOauthBusy(null);
    }
  };

  const savePendingSignup = (payload: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
  }) => {
    sessionStorage.setItem(
      SIGNUP_PENDING_STORAGE_KEY,
      JSON.stringify({
        ...payload,
        createdAt: Date.now(),
      }),
    );
  };

  const sendPhoneSignupCode = async (
    parsedPhoneE164: string,
    pending?: { email: string; password: string; fullName: string },
  ) => {
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: parsedPhoneE164,
        options: {
          shouldCreateUser: true,
        },
      });
      if (otpErr) {
        toast.error(otpErr.message);
        return;
      }
      if (pending) {
        savePendingSignup({
          email: pending.email,
          password: pending.password,
          fullName: pending.fullName,
          phone: parsedPhoneE164,
        });
      }
      toast.success("Check your phone for the verification code.");
      navigate("/verify-otp", {
        replace: true,
        state: { phone: parsedPhoneE164, flow: "signup" as const },
      });
    } finally {
      setLoading(false);
    }
  };

  const validateBeforeSubmit = (): { ok: true; phoneE164: string } | { ok: false } => {
    if (!isValidEmailFormat(email)) {
      toast.error("Please enter a valid email.");
      return { ok: false };
    }
    if (!passwordMeetsRequirements(password)) {
      toast.error("Use a stronger password: at least 8 characters with letters and numbers.");
      return { ok: false };
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don’t match.");
      return { ok: false };
    }
    const parsedPhone = toE164Ng(phone);
    if ("error" in parsedPhone) {
      toast.error(parsedPhone.error);
      return { ok: false };
    }
    return { ok: true, phoneE164: parsedPhone.e164 };
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validateBeforeSubmit();
    if (!validated.ok) return;

    const emailNorm = email.trim().toLowerCase();
    const nameTrim = fullName.trim();
    await sendPhoneSignupCode(validated.phoneE164, {
      email: emailNorm,
      password,
      fullName: nameTrim,
    });
  };

  const strengthColor =
    pwdStrength === "strong" ? "bg-emerald-500" : pwdStrength === "medium" ? "bg-amber-500" : "bg-red-400";
  const strengthWidth = pwdStrength === "strong" ? "100%" : pwdStrength === "medium" ? "66%" : "33%";

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-emerald-50/90 via-white to-gray-50">
      {step === "email" ? (
        <>
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 pb-4 pt-6 sm:px-6">
            <motion.div
              className="mx-auto w-full max-w-[440px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.42, 0, 1, 1] }}
            >
              <div className="mb-6 text-center">
                <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-emerald-800">
                  <span className="text-2xl" aria-hidden>
                    🌿
                  </span>
                  GreenHub
                </Link>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.65rem]">
                  Join GreenHub – free forever
                </h1>
                <p className="mt-2 text-sm text-gray-600">No credit card required. No spam.</p>
              </div>

              <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/50 px-4 py-3 text-left shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-100">
                    <Lock className="h-5 w-5 text-emerald-700" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium text-gray-900">Your data is safe – no hidden fees.</p>
                    <p className="flex items-center gap-1.5 text-gray-600">
                      <Users className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      Join 1,000+ sellers in Nigeria.
                    </p>
                    <p className="text-[11px] leading-snug text-emerald-900/85">
                      We&apos;ll verify your phone later – no spam, just security.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <AuthSocialButtons
                  onGoogle={() => void handleSocialLogin("google")}
                  onFacebook={() => void handleSocialLogin("facebook")}
                  busy={oauthBusy}
                  disabled={loading}
                />
              </div>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <span className="bg-white px-3">Or with email</span>
                </div>
              </div>

              <form id={FORM_ID} onSubmit={(e) => void handleEmailRegister(e)} className="space-y-4">
                <div>
                  <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={cn(
                        "h-12 w-full rounded-xl border bg-white px-4 pr-11 text-[15px] outline-none transition focus:ring-2 focus:ring-emerald-500/25",
                        emailTouched && !emailOk ? "border-red-200" : emailOk ? "border-emerald-300" : "border-gray-200",
                      )}
                    />
                    {emailTouched ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                        {emailOk ? (
                          <Check className="h-5 w-5 text-emerald-600 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <X className="h-5 w-5 text-red-500 animate-in zoom-in-50 duration-200" />
                        )}
                      </span>
                    ) : null}
                  </div>
                  {emailTouched && !emailOk ? (
                    <p className="mt-1 text-xs text-red-600">Enter a valid email address</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Full name <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="How should we greet you?"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-[15px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Phone number
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0803 123 4567"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-[15px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">Nigerian number only. We will verify by SMS OTP.</p>
                </div>

                <div>
                  <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-12 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", strengthColor)}
                        style={{ width: pwdOk ? strengthWidth : "0%" }}
                      />
                    </div>
                    <p className="text-xs font-medium text-gray-600">
                      {password.length === 0
                        ? "Strength: —"
                        : `Strength: ${pwdStrength.charAt(0).toUpperCase() + pwdStrength.slice(1)}`}
                    </p>
                    <ul className="text-[11px] text-gray-500">
                      <li className={password.length >= 8 ? "text-emerald-700" : ""}>• At least 8 characters</li>
                      <li className={/[0-9]/.test(password) ? "text-emerald-700" : ""}>• One number</li>
                      <li className={/[a-zA-Z]/.test(password) ? "text-emerald-700" : ""}>• One letter</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className={cn(
                        "h-12 w-full rounded-xl border bg-white px-4 pr-11 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/20",
                        confirmTouched && !confirmOk ? "border-red-200" : confirmOk ? "border-emerald-300" : "border-gray-200",
                      )}
                    />
                    {confirmTouched ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                        {confirmOk ? (
                          <Check className="h-5 w-5 text-emerald-600 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <X className="h-5 w-5 text-red-500 animate-in zoom-in-50 duration-200" />
                        )}
                      </span>
                    ) : null}
                  </div>
                  {confirmTouched && !confirmOk ? (
                    <p className="mt-1 text-xs text-red-600">Passwords must match</p>
                  ) : null}
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-emerald-700 hover:underline">
                  Sign in
                </Link>
              </p>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-400">
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
            </motion.div>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-gray-200/80 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto max-w-[440px]">
              <button
                type="submit"
                form={FORM_ID}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-md shadow-emerald-900/10 transition-transform duration-200 ease-out hover:scale-[1.02] hover:brightness-110 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : "Create account"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="rounded-full p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Phone number</h2>
                <p className="text-xs text-gray-500">We’ll text you a code to confirm.</p>
              </div>
            </div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Mobile number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0803 123 4567"
              autoComplete="tel"
              className="mb-6 h-12 w-full rounded-xl border border-gray-200 px-4 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="sticky bottom-0 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  const validated = validateBeforeSubmit();
                  if (!validated.ok) return;
                  void sendPhoneSignupCode(validated.phoneE164, {
                    email: email.trim().toLowerCase(),
                    password,
                    fullName: fullName.trim(),
                  });
                }}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-md transition-transform duration-200 ease-out hover:scale-[1.02] hover:brightness-110 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : "Send verification code"}
              </button>
            </div>
            <p className="mt-4 text-center text-[11px] text-gray-500">
              SMS requires Phone auth in your Supabase project settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
