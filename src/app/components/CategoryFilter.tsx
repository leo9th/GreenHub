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

type CategoryFilterProps = {
  selectedCategory: string;
  onCategoryChange: (category: CategoryFilterSelection) => void;
};

export default function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <div className="flex w-max min-w-full gap-2 pb-1">
        {CATEGORY_FILTER_LABELS.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#16a34a] bg-[#16a34a] text-white shadow-sm"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
