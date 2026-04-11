import { Check } from "lucide-react";
import { cn } from "./ui/utils";

type VerifiedBadgeProps = {
  /** Accessibility label */
  title?: string;
  className?: string;
  size?: "sm" | "md";
};

/** Twitter-style verified: blue circle, white checkmark. */
export function VerifiedBadge({ title = "Verified", className, size = "md" }: VerifiedBadgeProps) {
  const dim = size === "sm" ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]";
  const icon = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-white shadow-sm", dim, className)}
      title={title}
      aria-label={title}
      role="img"
    >
      <Check className={cn(icon, "stroke-[3]")} strokeWidth={3} aria-hidden />
    </span>
  );
}
