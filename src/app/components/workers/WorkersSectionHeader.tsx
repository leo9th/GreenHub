import { Link } from "react-router";
import { Briefcase, UserPlus, Users } from "lucide-react";

export default function WorkersSectionHeader() {
  return (
    <div className="bg-gradient-to-r from-[#14532d] via-[#166534] to-[#22c55e] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">GreenHub</p>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Find staff & labour</h1>
        <p className="text-sm text-white/85 mt-2 max-w-2xl">
          Workers can list what they do and how to reach them. Employers browse profiles and call or message
          candidates for interviews—separate from the marketplace.
        </p>
        <nav className="flex flex-wrap gap-2 mt-5 border-t border-white/20 pt-4" aria-label="Worker directory">
          <Link
            to="/workers"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <Users className="w-4 h-4 shrink-0" aria-hidden />
            Browse profiles
          </Link>
          <Link
            to="/workers/register"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
            Add your profile
          </Link>
          <Link
            to="/apply"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
          >
            <Briefcase className="w-4 h-4 shrink-0" aria-hidden />
            Formal job application (GreenHub)
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:underline px-2 py-2">
            ← Marketplace home
          </Link>
        </nav>
      </div>
    </div>
  );
}
