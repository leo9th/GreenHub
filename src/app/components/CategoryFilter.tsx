import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building,
  Car,
  Grid3x3,
  MoreHorizontal,
  Shirt,
  Sofa,
  Sparkles,
  Trophy,
  Tv,
} from "lucide-react";

export const CATEGORY_FILTER_LABELS = [
  "All",
  "Fashion",
  "Electronics",
  "Home & Living",
  "Vehicles",
  "Property",
  "Beauty",
  "Sports",
  "Other",
] as const;

export type CategoryFilterSelection = (typeof CATEGORY_FILTER_LABELS)[number];

const CATEGORY_ICONS: Record<CategoryFilterSelection, LucideIcon> = {
  All: Grid3x3,
  Fashion: Shirt,
  Electronics: Tv,
  "Home & Living": Sofa,
  Vehicles: Car,
  Property: Building,
  Beauty: Sparkles,
  Sports: Trophy,
  Other: MoreHorizontal,
};

type CategoryFilterProps = {
  selectedCategory: string;
  onCategoryChange: (category: CategoryFilterSelection) => void;
  /** Renders in the same row as the category strip (e.g. condition dropdown). */
  endSlot?: ReactNode;
};

export default function CategoryFilter({ selectedCategory, onCategoryChange, endSlot }: CategoryFilterProps) {
  return (
    <div className="mb-3 w-full px-4 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex w-full items-center justify-between gap-2 overflow-x-auto pb-2 no-scrollbar">
            {CATEGORY_FILTER_LABELS.map((category) => {
              const isActive = selectedCategory === category;
              const Icon = CATEGORY_ICONS[category];
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onCategoryChange(category)}
                  className={`group flex flex-1 min-w-[80px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? "-translate-y-1 border-emerald-500 bg-emerald-500 text-white shadow-md ring-1 ring-emerald-500/30"
                      : "border-transparent bg-gray-100 text-gray-900 shadow-sm hover:scale-105 hover:shadow-lg hover:shadow-gray-300/80"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                      isActive
                        ? "rounded-full border border-white/30 bg-white/15 text-white"
                        : "rounded-full border border-slate-200 bg-white text-gray-700 group-hover:bg-white group-hover:text-emerald-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight tracking-tight sm:text-xs">{category}</span>
                </button>
              );
            })}
          </div>
        </div>
        {endSlot ? <div className="shrink-0 max-w-full">{endSlot}</div> : null}
      </div>
    </div>
  );
}
