import { useCallback, useEffect, useState } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

type FollowButtonProps = {
  targetUserId: string;
  /** When the target profile row is missing / not loadable */
  profileMissing?: boolean;
  /** Parent holds aggregate follower count; +/-1 on successful toggle */
  onFollowersDelta?: (delta: number) => void;
  className?: string;
};

/**
 * Follow / unfollow another member (uses `profile_follows`).
 * Hidden on your own profile.
 */
export function FollowButton({ targetUserId, profileMissing, onFollowersDelta, className }: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || user.id === targetUserId) {
      setIsFollowing(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: edge } = await supabase
        .from("profile_follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (!cancelled) {
        setIsFollowing(!!edge);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, targetUserId]);

  const handleClick = useCallback(async () => {
    if (!user?.id || user.id === targetUserId || profileMissing) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("profile_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
        setIsFollowing(false);
        onFollowersDelta?.(-1);
      } else {
        const { error } = await supabase.from("profile_follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
        if (error) throw error;
        setIsFollowing(true);
        onFollowersDelta?.(1);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  }, [user?.id, targetUserId, profileMissing, isFollowing, onFollowersDelta]);

  if (profileMissing) return null;
  if (!user?.id || user.id === targetUserId) return null;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={followBusy || !checked || profileMissing}
      className={
        className ??
        `inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 ${
          isFollowing
            ? "border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
            : "border border-[#22c55e]/40 bg-white text-[#15803d] hover:bg-[#f0fdf4]"
        }`
      }
    >
      {followBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="w-3.5 h-3.5" />
      ) : (
        <UserPlus className="w-3.5 h-3.5" />
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
