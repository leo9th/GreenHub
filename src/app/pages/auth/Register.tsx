import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Check, Eye, EyeOff, Loader2, Lock, ShoppingBag, Store, Users, X } from "@/app/icons/emojiLucide";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { AuthSocialButtons } from "../../components/auth/AuthSocialButtons";
import { oauthCallbackRedirectTo } from "../../utils/authSiteUrl";
import {
  getPasswordStrength,
  isValidEmailFormat,
  mapSignUpErrorToToast,
  passwordMeetsRequirements,
} from "../../utils/authSignupValidation";
import { cn } from "../../components/ui/utils";
import { AuthFloatingIcons } from "../../components/auth/AuthFloatingIcons";

const TOTAL_STEPS = 4;
const FORM_ID = "greenhub-signup-form";

type SignupRole = "buyer" | "seller" | "rider";

const ROLE_OPTIONS: {
  value: SignupRole;
  title: string;
  description: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    value: "buyer",
    title: "Buyer",
    description: "I want to buy products",
    icon: ShoppingBag,
  },
  {
    value: "seller",
    title: "Seller",
    description: "I want to sell products",
    icon: Store,
  },
  {
    value: "rider",
    title: "Rider",
    description: "I want to deliver products",
    icon: Bike,
  },
];

export default function Register() {
  const navigate = useNavigate();
  const { user, signUp, signInWithOAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SignupRole>("buyer");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "facebook" | null>(null);

  const oauthRedirect = oauthCallbackRedirectTo("/welcome");

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  const emailOk = useMemo(() => isValidEmailFormat(email), [email]);
  const emailTouched = email.length > 0;
  const pwdStrength = useMemo(() => getPasswordStrength(password), [password]);
  const pwdOk = passwordMeetsRequirements(password);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setOauthBusy(provider);
    try {
      await signInWithOAuth(provider, {
        redirectTo: oauthRedirect,
        ...(provider === "google"
          ? {
              queryParams: {
                prompt: "select_account",
                access_type: "offline",
              },
            }
          : {}),
      });
      toast.message("Redirecting…", { duration: 2500 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start social sign-in.");
    } finally {
      setOauthBusy(null);
    }
  };

  const validateStep1 = (): boolean => {
    if (!isValidEmailFormat(email)) {
      toast.error("Please enter a valid email.");
      return false;
    }
    if (!passwordMeetsRequirements(password)) {
      toast.error("Use a stronger password: at least 8 characters with letters and numbers.");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don’t match.");
      return false;
    }
    return true;
  };

  const validateBeforeSubmit = (): boolean => validateStep1();

  const handleContinue = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step <= 1) return;
    setStep((s) => s - 1);
  };

  const submitSignup = async () => {
    if (!validateBeforeSubmit()) return;

    const emailNorm = email.trim().toLowerCase();
    const nameTrim = fullName.trim();
    setLoading(true);
    try {
      await signUp(emailNorm, password, {
        full_name: nameTrim || null,
        phone: phone.trim() || null,
        role,
      });
      toast.success("Check your email for a confirmation link.");
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? mapSignUpErrorToToast(err.message) : "Could not create account.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      handleContinue();
      return;
    }
    void submitSignup();
  };

  const strengthColor =
    pwdStrength === "strong" ? "bg-emerald-500" : pwdStrength === "medium" ? "bg-amber-500" : "bg-red-400";
  const strengthWidth = pwdStrength === "strong" ? "100%" : pwdStrength === "medium" ? "66%" : "33%";

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.title ?? role;

  const stepTitles = ["Account", "About you", "Your role", "Review"];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-emerald-50/90 via-white to-gray-50">
      <AuthFloatingIcons />
      <>
        <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 pb-4 pt-6 sm:px-6">
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

            {/* Step indicator (email path only) */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
                <span>
                  Step {step} of {TOTAL_STEPS}
                  <span className="text-gray-400"> · {stepTitles[step - 1]}</span>
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i < step ? "bg-emerald-600" : "bg-gray-200",
                    )}
                  />
                ))}
              </div>
            </div>

            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
            ) : null}

            <form id={FORM_ID} onSubmit={handleFormSubmit} className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                  <motion.div
                    key="s1"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
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
                  </motion.div>
                ) : null}

                {step === 2 ? (
                  <motion.div
                    key="s2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
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
                        Phone number <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0803 123 4567"
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-[15px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <p className="mt-1 text-[11px] text-gray-500">Optional. You can verify it later from profile settings.</p>
                    </div>
                  </motion.div>
                ) : null}

                {step === 3 ? (
                  <motion.div
                    key="s3"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-gray-600">How will you use GreenHub? You can change this later in settings.</p>
                    <fieldset>
                      <legend className="sr-only">Account role</legend>
                      <div className="flex flex-col gap-3">
                        {ROLE_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const selected = role === opt.value;
                          return (
                            <label
                              key={opt.value}
                              className={cn(
                                "flex cursor-pointer items-start gap-4 rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors",
                                selected ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-gray-100 hover:border-emerald-200",
                              )}
                            >
                              <input
                                type="radio"
                                name="signup-role"
                                value={opt.value}
                                checked={selected}
                                onChange={() => setRole(opt.value)}
                                className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                <Icon className="h-5 w-5" aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-gray-900">{opt.title}</span>
                                <span className="mt-0.5 block text-sm text-gray-600">{opt.description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </motion.div>
                ) : null}

                {step === 4 ? (
                  <motion.div
                    key="s4"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-gray-600">Confirm your details, then we&apos;ll send a confirmation link to your email.</p>
                    <dl className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Email</dt>
                        <dd className="max-w-[60%] truncate text-right font-medium text-gray-900">{email.trim() || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Name</dt>
                        <dd className="text-right font-medium text-gray-900">{fullName.trim() || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Phone</dt>
                        <dd className="text-right font-medium text-gray-900">{phone.trim() || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Role</dt>
                        <dd className="text-right font-medium text-gray-900">{roleLabel}</dd>
                      </div>
                    </dl>
                  </motion.div>
                ) : null}
              </AnimatePresence>
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

        <div className="relative z-10 sticky bottom-0 border-t border-gray-200/80 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto flex max-w-[440px] gap-3">
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-md shadow-emerald-900/10 transition-transform duration-200 ease-out hover:scale-[1.02] hover:brightness-110 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                form={FORM_ID}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-md shadow-emerald-900/10 transition-transform duration-200 ease-out hover:scale-[1.02] hover:brightness-110 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : "Create account"}
              </button>
            )}
          </div>
        </div>
      </>
    </div>
  );
}
