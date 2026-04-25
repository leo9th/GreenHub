import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Loader2, Bike } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function RiderLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-400" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (String(profile?.role ?? "").toLowerCase() !== "rider") {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link to="/rider" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <Bike className="h-5 w-5 text-emerald-300" aria-hidden />
            </span>
            Rider
          </Link>
          <nav className="flex gap-3 text-sm text-slate-400">
            <Link to="/rider" className="hover:text-emerald-300">
              Dashboard
            </Link>
            <Link to="/" className="hover:text-slate-200">
              Site
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
