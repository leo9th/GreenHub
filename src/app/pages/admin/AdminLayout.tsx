import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220]">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" aria-hidden />
        <span className="sr-only">Loading admin…</span>
      </div>
    );
  }

  if (!user || String(profile?.role ?? "").toLowerCase() !== "admin") {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1220] text-slate-100">
      <header className="shrink-0 border-b border-emerald-500/20 bg-[#0b1220]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link
            to="/admin/dashboard"
            className="text-base font-semibold tracking-tight text-emerald-300 sm:text-lg"
          >
            GreenHub Admin
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="text-sm text-emerald-200/75 transition-colors hover:text-emerald-300"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-emerald-500/35 bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
