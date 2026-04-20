import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./ui/utils";

export type CollapsibleFiltersProps = {
  /** Stable id prefix for `aria-controls` / region (use page-specific, e.g. `home` / `shop`). */
  idPrefix: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Accessible collapsible block for secondary browse filters (condition, price, location, etc.).
 */
export default function CollapsibleFilters({
  idPrefix,
  isOpen,
  onOpenChange,
  children,
  className,
}: CollapsibleFiltersProps) {
  const reactId = useId();
  const baseId = `${idPrefix}-${reactId.replace(/:/g, "")}`;
  const toggleId = `${baseId}-toggle`;
  const panelId = `${baseId}-panel`;

  return (
    <div className={cn("mt-4 border-t border-gray-200 pt-4", className)}>
      <button
        type="button"
        id={toggleId}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-2 text-left font-bold text-gray-900 outline-none ring-offset-2 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#22c55e] dark:text-zinc-100 dark:hover:bg-zinc-800/80"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span>More filters</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-gray-600 transition-transform duration-300 ease-out dark:text-zinc-400",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={toggleId}
        aria-hidden={!isOpen}
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[min(32rem,85vh)] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div
          className={cn(
            "mt-3 space-y-4 pb-1",
            !isOpen && "pointer-events-none select-none",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
