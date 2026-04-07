import { Link, useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Smartphone } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { AuthSocialButtons } from "../../components/auth/AuthSocialButtons";
import { toE164Ng } from "../../utils/phoneE164";
import { nigerianStates } from "../../data/catalogConstants";
import { getLGAsForState } from "../../data/mockData";

type Step = "choose" | "phone" | "email";

const REDIRECT = typeof window !== "undefined" ? window.location.origin : "";

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "facebook" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailPhone, setEmailPhone] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const selectedRole = "buyer";
  const [selectedState, setSelectedState] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");

  const lgas = selectedState ? getLGAsForState(selectedState) : [];

  const oauthRedirect = `${REDIRECT}/login`;

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

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!selectedState || !lga) {
      setError("Please select your state and LGA.");
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    let phoneForMeta: string | undefined;
    if (emailPhone.trim()) {
      const p = toE164Ng(emailPhone);
      if ("error" in p) {
        setError(p.error);
        return;
      }
      phoneForMeta = p.e164;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: {
          emailRedirectTo: `${REDIRECT}/login`,
          data: {
            full_name: fullName.trim(),
            phone: phoneForMeta ?? "",
            role: selectedRole,
            gender,
            state: selectedState,
            lga,
            address: address.trim() || "",
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("rate limit")) {
          setError(
            "Too many sign-up attempts. Wait a few minutes or adjust email rate limits in the Supabase dashboard.",
          );
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data?.session) {
        toast.success("Account ready.");
        navigate("/", { replace: true });
        return;
      }

      navigate(`/check-email?email=${encodeURIComponent(emailNorm)}`, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const headerTitle =
    step === "choose" ? null : step === "phone" ? "Phone number" : "Register with email";

  const headerSubtitle =
    step === "phone" ? "We’ll text you a code to confirm." : step === "email" ? "We’ll email you a confirmation link." : null;

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
              <h1 className="text-lg font-bold text-gray-900">{headerTitle}</h1>
              {headerSubtitle ? <p className="text-xs text-gray-500">{headerSubtitle}</p> : null}
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
                onClick={() => setStep("email")}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 py-3.5 text-sm font-bold text-gray-800 hover:border-[#22c55e]/40 hover:bg-[#f0fdf4]/50"
              >
                <Mail className="h-5 w-5 shrink-0 text-[#15803d]" aria-hidden />
                Register with email
              </button>

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
          ) : step === "phone" ? (
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
          ) : (
            <>
              {error ? (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form onSubmit={(e) => void handleEmailRegister(e)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone (optional)</label>
                  <input
                    type="tel"
                    value={emailPhone}
                    onChange={(e) => setEmailPhone(e.target.value)}
                    placeholder="080…"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  >
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">State</label>
                  <select
                    required
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setLga("");
                    }}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  >
                    <option value="">Select state</option>
                    {nigerianStates.map((state) => (
                      <option key={state.code} value={state.name}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedState ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">LGA</label>
                    <select
                      required
                      value={lga}
                      onChange={(e) => setLga(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                    >
                      <option value="">Select LGA</option>
                      {lgas.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Address (optional)</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, area…"
                    autoComplete="street-address"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#166534] disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  Create account
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500">
                You must confirm your email before you can sign in with a password. Check your inbox after submitting.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
