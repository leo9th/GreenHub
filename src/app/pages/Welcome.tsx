import { Link, useNavigate } from "react-router";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Package, UserPen } from "lucide-react";
import { cn } from "../components/ui/utils";

function profileCompletionPercent(profile: {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  state?: string | null;
  lga?: string | null;
  address?: string | null;
} | null): number {
  if (!profile) return 5;
  let pts = 0;
  if (profile.full_name?.trim()) pts += 25;
  if (profile.phone?.trim()) pts += 25;
  if (profile.avatar_url) pts += 25;
  if ((profile.state && profile.lga) || profile.address?.trim()) pts += 25;
  return pts;
}

export default function Welcome() {
  const navigate = useNavigate();
  const { profile, user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
    "Seller";

  const pct = profileCompletionPercent(profile);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-gray-50 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-4 text-6xl" aria-hidden>
            🎉
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Welcome, {displayName}!</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">You&apos;re now part of GreenHub&apos;s growing community.</p>
        </div>

        <div className="mt-8 w-full animate-in fade-in duration-500 [animation-delay:120ms] [animation-fill-mode:both]">
          <p className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Profile completion</span>
            <span className="tabular-nums text-emerald-700">{pct}%</span>
          </p>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700 ease-out")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-8 w-full space-y-3 animate-in fade-in duration-500 [animation-delay:200ms] [animation-fill-mode:both]">
          <Link
            to="/seller/products/new"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 transition hover:scale-[1.01] hover:bg-emerald-700 active:scale-[0.99]"
          >
            <Package className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
            Upload your first product
          </Link>
          <Link
            to="/profile"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:scale-[1.01] hover:bg-gray-50 active:scale-[0.99]"
          >
            <UserPen className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
            Complete your profile ({pct}%)
          </Link>
        </div>

        <p className="mt-10 text-xs text-gray-400">
          <Link to="/products" className="font-medium text-emerald-700 underline-offset-2 hover:text-emerald-800 hover:underline">
            Explore the marketplace
          </Link>
        </p>
      </div>
    </div>
  );
}
