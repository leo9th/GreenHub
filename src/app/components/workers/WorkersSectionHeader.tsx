import { Link } from "react-router";
import { Briefcase, UserPlus, Users } from "lucide-react";

export default function WorkersSectionHeader() {
  return (
    <div className="bg-gradient-to-r from-[#14532d] via-[#166534] to-[#22c55e] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Public directory · GreenHub</p>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Find artisans &amp; workers to hire</h1>
        <p className="text-sm text-white/85 mt-2 max-w-2xl leading-relaxed">
          For <strong className="font-semibold text-white">anyone</strong> visiting GreenHub—homeowners, businesses, or
          contractors looking for drivers, labour, plumbers, electricians, and other skilled hands. Browse profiles and
          contact people <strong className="font-semibold text-white">directly</strong>. This is not GreenHub
          employment; it&apos;s a free community board alongside the marketplace.
        </p>
        <nav className="flex flex-wrap gap-2 mt-5 border-t border-white/20 pt-4" aria-label="Public hire directory">
          <Link
            to="/workers"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <Users className="w-4 h-4 shrink-0" aria-hidden />
            Search directory
          </Link>
          <Link
            to="/workers/register"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
            List your skills (get found)
          </Link>
          <Link
            to="/apply"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <Briefcase className="w-4 h-4 shrink-0" aria-hidden />
            Apply to GreenHub / partners (separate)
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:underline px-2 py-2">
            ← Marketplace home
          </Link>
        </nav>
      </div>
    </div>
  );
}
