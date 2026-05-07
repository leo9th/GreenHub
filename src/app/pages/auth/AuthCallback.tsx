import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "@/app/icons/emojiLucide";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { safeInternalPath } from "../../utils/authSignupValidation";
import { AuthFloatingIcons } from "../../components/auth/AuthFloatingIcons";

/**
 * OAuth PKCE + email confirmation landing URL.
 *
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs must include:
 *   - http://localhost:5173/auth/callback
 *   - https://your-production-domain/auth/callback
 *
 * Google Cloud Console → OAuth client → Authorized redirect URIs must include **only** Supabase’s callback:
 *   https://<project-ref>.supabase.co/auth/v1/callback
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

      const oauthError = searchParams.get("error");
      const oauthErrorDesc = searchParams.get("error_description");
      if (oauthError || oauthErrorDesc) {
        const human = (oauthErrorDesc ?? oauthError)?.replace(/\+/g, " ") ?? "Sign-in was cancelled or failed.";
        toast.error(human);
        navigate("/login", { replace: true });
        return;
      }

      const hashErr = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
      if (hashErr) {
        toast.error(hashErr.replace(/\+/g, " "));
        navigate("/login", { replace: true });
        return;
      }

      const rawCode = searchParams.get("code");
      const code = typeof rawCode === "string" ? rawCode.trim() : "";

      if (code.length > 0) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("code");
        window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        try {
          await exchangeCodeForSession(code);
          toast.success("You’re signed in.");
          navigate(next, { replace: true });
          return;
        } catch (err) {
          const authLike = err as { message?: string; code?: string; status?: number };
          console.error("[AuthCallback] exchangeCodeForSession failed", {
            message: authLike.message ?? (err instanceof Error ? err.message : String(err)),
            code: authLike.code,
            status: authLike.status,
            raw: err,
          });
          const detail = err instanceof Error ? err.message : String(err);
          toast.error("We couldn’t finish signing you in.", {
            description:
              detail.includes("exchange") || detail.includes("code") || detail.toLowerCase().includes("pkce")
                ? "Check Google Cloud redirect URI (Supabase callback), Client Secret in Supabase, and Redirect URLs including this app’s /auth/callback."
                : detail.length <= 160
                  ? detail
                  : `${detail.slice(0, 157)}…`,
          });
          navigate("/login", { replace: true });
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
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
