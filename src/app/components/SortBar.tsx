import type { ListingSort } from "../utils/productSearch";
import { LISTING_SORT_OPTIONS } from "../utils/productSearch";

type Props = {
  value: ListingSort;
  onChange: (next: ListingSort) => void;
  /** When set, prepended to the row (e.g. result count). */
  leading?: React.ReactNode;
  className?: string;
  id?: string;
};

export function SortBar({ value, onChange, leading, className = "", id = "listing-sort" }: Props) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      {leading != null ? <div className="min-w-0 shrink text-sm text-gray-600">{leading}</div> : null}
      <div className="flex items-center gap-2 sm:ml-auto sm:shrink-0">
        <label htmlFor={id} className="text-sm whitespace-nowrap text-gray-600">
          Sort by
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as ListingSort)}
          className="min-w-[11rem] max-w-full rounded-lg border border-[#22c55e]/35 bg-white px-3 py-2 text-sm font-medium text-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
        >
          {LISTING_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
