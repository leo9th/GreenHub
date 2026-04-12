import { Link } from "react-router";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

/** Compact follower count: 1200 → 1.2K */
export function formatFollowerShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 1 : 1)}K`;
  return String(n);
}

/** @handle from display name (no dedicated username column). */
export function derivePeerHandle(peerName: string): string {
  const first = peerName.trim().split(/\s+/)[0] || "member";
  const slug = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
  return slug ? `@${slug}` : "@member";
}

export type ChatPeerHeaderModernProps = {
  peerId: string | null;
  peerName: string;
  avatarSrc: string;
  /** e.g. @sarahj — defaults from derivePeerHandle(peerName) */
  handle?: string;
  followerCount: number | null;
  /** Short last-seen label when not online, e.g. from formatListTime */
  lastSeenShort?: string | null;
  isTyping: boolean;
  isOnline: boolean;
  isActiveNow: boolean;
  onBack: () => void;
  menu: React.ReactNode;
  /** Extra classes on root header (position/sticky) */
  className?: string;
};

/**
 * iMessage × Slack style peer row: back · avatar + name/@handle/status · ⋮
 */
export function ChatPeerHeaderModern({
  peerId,
  peerName,
  avatarSrc,
  handle: handleProp,
  followerCount,
  lastSeenShort,
  isTyping,
  isOnline,
  isActiveNow,
  onBack,
  menu,
  className,
}: ChatPeerHeaderModernProps) {
  const handle = handleProp ?? derivePeerHandle(peerName);
  const profileTo = peerId ? `/profile/${peerId}` : "/messages";

  const statusLine = (() => {
    const followersPart =
      followerCount != null ? ` • 👥 ${formatFollowerShort(followerCount)} followers` : "";
    if (isTyping) {
      return { dotClass: "bg-amber-400", text: `typing…${followersPart}`, dim: false };
    }
    if (isOnline || isActiveNow) {
      return {
        dotClass: "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)] animate-pulse",
        text: `Online${followersPart}`,
        dim: false,
      };
    }
    if (lastSeenShort) {
      return {
        dotClass: "bg-zinc-400 dark:bg-zinc-500",
        text: `Last seen ${lastSeenShort}${followersPart}`,
        dim: true,
      };
    }
    return {
      dotClass: "bg-zinc-400 dark:bg-zinc-500",
      text: `Offline${followersPart}`,
      dim: true,
    };
  })();

  const center = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className={cn(
          "relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-200 shadow-md transition-transform duration-200 dark:border-zinc-700 dark:bg-zinc-800",
          "hover:scale-[1.02] hover:shadow-[0_0_0_3px_rgba(16,185,129,0.28)] focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.35)]",
        )}
      >
        <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{peerName}</p>
        <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{handle}</p>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight",
            statusLine.dim ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-300",
          )}
        >
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", statusLine.dotClass)}
            aria-hidden
          />
          <span className="min-w-0 truncate">{statusLine.text}</span>
        </p>
      </div>
    </div>
  );

  return (
    <header
      className={cn(
        "flex items-center gap-2 border-b border-black/[0.06] bg-white/95 px-3 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/95 sm:gap-3 sm:px-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-600 transition-transform hover:bg-emerald-500/10 active:scale-95 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
        aria-label="Back"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {peerId ? (
        <Link
          to={profileTo}
          className="flex min-w-0 flex-1 items-center rounded-xl px-1 py-0.5 transition-colors hover:bg-zinc-100/80 dark:hover:bg-white/5"
          aria-label={`View ${peerName}'s profile`}
        >
          {center}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center px-1 py-0.5">{center}</div>
      )}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-emerald-400"
            aria-label="More options"
          >
            <MoreVertical className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem] rounded-xl border-zinc-200/80 p-1 shadow-lg dark:border-zinc-700">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
