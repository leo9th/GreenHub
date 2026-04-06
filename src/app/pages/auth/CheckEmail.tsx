import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export default function CheckEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email")?.trim() ?? "";

  const [resendBusy, setResendBusy] = useState(false);

  const handleResend = async () => {
    if (!emailParam) {
      toast.error("No email address. Start registration again.");
      return;
    }
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailParam.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Confirmation email sent again. Check your inbox.");
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] via-white to-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/60">
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign up
        </button>

        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#22c55e]/10">
          <Mail className="h-8 w-8 text-[#15803d]" />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">Confirm your email</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-600">
          We sent a secure link to{" "}
          <span className="font-semibold text-gray-900 break-all">{emailParam || "your email"}</span>. Open it on this
          device to activate your account and finish signing in.
        </p>

        <div className="mt-8 rounded-xl bg-amber-50/90 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-100">
          <p className="font-medium">Didn’t get the email?</p>
          <p className="mt-1 text-amber-900/85">
            Check spam or promotions. You can resend below. In Supabase, ensure email confirmations are enabled under{" "}
            <span className="font-mono text-[11px]">Authentication → Providers → Email</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resendBusy || !emailParam}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#22c55e] py-3.5 text-sm font-bold text-[#15803d] transition-colors hover:bg-[#22c55e]/10 disabled:opacity-50"
        >
          {resendBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Resend confirmation email
        </button>

        <p className="mt-8 text-center text-sm text-gray-600">
          Wrong address?{" "}
          <Link to="/register" className="font-semibold text-[#15803d] hover:underline">
            Change email
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already confirmed?{" "}
          <Link to="/login" className="font-semibold text-[#15803d] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
