import type { ReactNode } from "react";

type Props = {
  onSearch: (q: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  children?: ReactNode;
};

/** Search affordances — wire `onSearch` to navigation or parent state. */
export function SmartSearch({ onSearch, suggestions = [], recentSearches = [], children }: Props) {
  return (
    <div className="space-y-2">
      {children}
      {recentSearches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Recent</span>
          {recentSearches.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-800 hover:border-[#22c55e]"
              onClick={() => onSearch(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Popular</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-emerald-100 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-[#15803d] hover:bg-emerald-100"
              onClick={() => onSearch(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
