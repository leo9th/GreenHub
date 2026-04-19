import { getConditionFilterDropdownOptions } from "../data/productConditions";

export type ConditionFilterProps = {
  /** `products.category` slug, or `null` when “All categories”. */
  categorySlug: string | null;
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function ConditionFilter({ categorySlug, value, onChange, id = "condition-filter" }: ConditionFilterProps) {
  const opts = getConditionFilterDropdownOptions(categorySlug);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        Condition
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
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
