/**
 * Stored in `products.subcategory` when category is `electronics`.
 * "Others" uses free-text in the same column.
 */
export const ELECTRONICS_SUBCATEGORY_OPTIONS = [
  { value: "Laptops", label: "Laptops" },
  { value: "Phones & Tablets", label: "Phones & Tablets" },
  { value: "Generators", label: "Generators" },
  { value: "Refrigerators", label: "Refrigerators" },
  { value: "Television", label: "Television" },
  { value: "Air Conditioners", label: "Air Conditioners" },
  { value: "Audio & Speakers", label: "Audio & Speakers" },
  { value: "Gaming Consoles", label: "Gaming Consoles" },
  { value: "Cameras", label: "Cameras" },
] as const;

export const ELECTRONICS_SUBCATEGORY_SELECT_OTHER = "__other__";

export function labelForElectronicsSubcategory(value: string) {
  return ELECTRONICS_SUBCATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
