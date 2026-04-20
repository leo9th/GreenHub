import { useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";

export const DEFAULT_MORE_FILTERS_SECTION_ID = "more-filters-section";

type FloatingFiltersButtonProps = {
  /** When true, the FAB is shown (typically when the collapsible is closed). */
  visible: boolean;
  /** Called to open the filters panel (e.g. `() => setMoreFiltersOpen(true)`). */
  onOpen: () => void;
  /** Must match `CollapsibleFilters` `sectionId`. */
  sectionId?: string;
};

/**
 * Fixed “Filters” control when the more-filters panel is collapsed; opens and scrolls into view.
 */
export default function FloatingFiltersButton({
  visible,
  onOpen,
  sectionId = DEFAULT_MORE_FILTERS_SECTION_ID,
}: FloatingFiltersButtonProps) {
  const handleClick = useCallback(() => {
    onOpen();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, [onOpen, sectionId]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
      aria-label="Open filters"
    >
      <SlidersHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
