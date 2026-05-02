import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "@/app/icons/emojiLucide";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { safeInternalPath } from "../../utils/authSignupValidation";
import { AuthFloatingIcons } from "../../components/auth/AuthFloatingIcons";

/**
 * Email confirmation + OAuth code exchange landing URL.
 * Add this path to Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { exchangeCodeForSession } = useAuth();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const nextRaw = searchParams.get("next");
      const next = safeInternalPath(nextRaw) ?? "/welcome";

      const code = searchParams.get("code");
      const hashErr = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");

      if (hashErr) {
        toast.error(hashErr.replace(/\+/g, " "));
        navigate("/login", { replace: true });
        return;
      }

      if (code) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("code");
        window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        try {
          await exchangeCodeForSession(code);
          toast.success("You’re signed in.");
          navigate(next, { replace: true });
          return;
        } catch {
          toast.error("This sign-in link is invalid or expired.");
          navigate("/login", { replace: true });
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        toast.success("You’re signed in.");
        navigate(next, { replace: true });
        return;
      }

      setMessage("Could not complete sign-in.");
      toast.error("Session not found. Try signing in again.");
      navigate("/login", { replace: true });
    };

    void run();
  }, [exchangeCodeForSession, navigate, searchParams]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#ecfdf5] via-white to-gray-50 p-6">
      <AuthFloatingIcons />
      <div className="relative z-10 flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white/90 px-10 py-8 shadow-lg backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-[#15803d]" aria-hidden />
        <p className="text-sm font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
}
