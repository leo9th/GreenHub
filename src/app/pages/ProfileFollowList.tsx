import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { FollowButton } from "../components/FollowButton";

type Row = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

export default function ProfileFollowList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeUserId } = useParams<{ id?: string }>();
  const { user: authUser, loading: authLoading } = useAuth();

  const mode = location.pathname.endsWith("/following") ? "following" : "followers";

  const targetUserId = useMemo(() => routeUserId?.trim() ?? "", [routeUserId]);

  const [subjectName, setSubjectName] = useState<string>("Member");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!targetUserId || !isUuid(targetUserId)) {
      setError("Invalid profile link.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pub = await supabase
        .from("profiles_public")
        .select("id, full_name, avatar_url, gender")
        .eq("id", targetUserId)
        .maybeSingle();
      if (!pub.error && pub.data) {
        setSubjectName((pub.data as { full_name?: string | null }).full_name?.trim() || "Member");
      } else {
        const fb = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, gender")
          .eq("id", targetUserId)
          .maybeSingle();
        setSubjectName((fb.data as { full_name?: string | null } | null)?.full_name?.trim() || "Member");
      }

      const rpcName = mode === "followers" ? "list_profile_followers" : "list_profile_following";
      const { data: edges, error: rpcErr } = await supabase.rpc(rpcName, { p_user_id: targetUserId });

      if (rpcErr) {
        if (
          String(rpcErr.message ?? "").includes("function") ||
          String(rpcErr.message ?? "").includes("does not exist")
        ) {
          setError("Follow lists are not available yet. Apply the latest database migration.");
        } else {
          setError(rpcErr.message || "Could not load list.");
        }
        setRows([]);
        return;
      }

      const list = (edges ?? []) as { follower_id?: string; following_id?: string }[];
      const ids = list
        .map((e) => (mode === "followers" ? e.follower_id : e.following_id))
        .filter((x): x is string => typeof x === "string" && x.length > 0);

      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from("profiles_public")
        .select("id, full_name, avatar_url, gender")
        .in("id", ids);

      if (pErr) {
        console.warn("profiles_public follow list:", pErr);
        setRows([]);
        return;
      }

      const byId = new Map<string, Row>();
      for (const p of (profs ?? []) as Row[]) {
        if (p.id) byId.set(p.id, p);
      }

      const ordered: Row[] = [];
      for (const uid of ids) {
        const p = byId.get(uid);
        if (p) ordered.push(p);
        else ordered.push({ id: uid, full_name: "Member", avatar_url: null, gender: null });
      }
      setRows(ordered);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load list");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, mode]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const title = mode === "followers" ? "Followers" : "Following";

  if (authLoading || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-3 sm:px-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
            <p className="text-xs text-gray-500 truncate">{subjectName}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-3 pt-4 sm:px-4">
        {error ? (
          <p className="text-sm text-red-600 py-6">{error}</p>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">
            {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 overflow-hidden">
            {rows.map((r) => {
              const name = r.full_name?.trim() || "Member";
              const av = getAvatarUrl(r.avatar_url, r.gender, name);
              const isSelf = authUser.id === r.id;
              return (
                <li key={r.id} className="flex items-center gap-3 p-4">
                  <Link to={`/profile/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <img src={av} alt="" className="h-12 w-12 shrink-0 rounded-full border border-gray-100 object-cover" />
                    <span className="truncate font-medium text-gray-900">{name}</span>
                  </Link>
                  {!isSelf ? (
                    <div className="shrink-0 w-[104px]">
                      <FollowButton targetUserId={r.id} size="compact" />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
