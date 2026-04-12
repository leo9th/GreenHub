import { Megaphone } from "lucide-react";
import { cn } from "./ui/utils";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

/** Shown for sellers with at least one successful paid boost (profiles.is_verified_advertiser). */
export function VerifiedAdvertiserBadge({ className, size = "sm" }: Props) {
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";
  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const icon = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-full bg-amber-100 font-bold uppercase leading-none tracking-wide text-amber-950 ring-1 ring-amber-400/70 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-600/60",
        pad,
        text,
        className,
      )}
      title="Verified advertiser — completed paid listing boost"
    >
      <Megaphone className={cn("shrink-0", icon)} aria-hidden />
      <span className="truncate">Verified Advertiser</span>
    </span>
  );
}
