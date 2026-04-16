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
};

export default function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
      <div className="flex w-max min-w-full snap-x snap-mandatory gap-3 pb-1">
        {CATEGORY_FILTER_LABELS.map((category) => {
          const isActive = selectedCategory === category;
          const Icon = CATEGORY_ICONS[category];
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`group flex w-[5.75rem] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-24 ${
                isActive
                  ? "scale-[1.02] border-emerald-600 bg-emerald-600 text-white shadow-md ring-1 ring-emerald-600/30 hover:scale-105 hover:shadow-lg"
                  : "border-transparent bg-gray-100 text-gray-900 shadow-sm hover:scale-105 hover:shadow-lg hover:shadow-gray-300/80"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-white/80 text-gray-700 group-hover:bg-white group-hover:text-emerald-700"
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
  );
}
