import { getConditionFilterDropdownOptions } from "../data/productConditions";
import { cn } from "./ui/utils";

export type ConditionFilterProps = {
  /** `products.category` slug, or `null` when “All categories”. */
  categorySlug: string | null;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Single-row label + control (for toolbar / category row). */
  inline?: boolean;
  className?: string;
};

export function ConditionFilter({
  categorySlug,
  value,
  onChange,
  id = "condition-filter",
  inline = false,
  className,
}: ConditionFilterProps) {
  const opts = getConditionFilterDropdownOptions(categorySlug);
  return (
    <div
      className={cn(
        inline ? "mb-0 flex flex-wrap items-center gap-x-2 gap-y-1" : "mb-4",
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-gray-700",
          inline ? "shrink-0" : "mb-1 block",
        )}
      >
        Condition
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]",
          inline
            ? "min-w-[11rem] max-w-full flex-1 sm:max-w-xs"
            : "w-full max-w-md",
        )}
      >
        <option value="all">All conditions</option>
        {opts.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
