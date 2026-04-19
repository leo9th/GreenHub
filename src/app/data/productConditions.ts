/** Base condition labels (all categories). */
export const BASE_PRODUCT_CONDITIONS = ["New", "Like New", "Good", "Fair"] as const;

/** Local / general used listings (all categories that allow “used”). */
export const CONDITION_USED = "Used";

/** Tokunbo-style; only offered for Vehicles & Electronics in the UI. */
export const CONDITION_FOREIGN_USED = "Foreign Used";

const VEHICLE_OR_ELECTRONICS = new Set(["vehicles", "electronics"]);

export function categorySlugShowsForeignUsed(slug: string): boolean {
  return VEHICLE_OR_ELECTRONICS.has(slug);
}

/**
 * Condition dropdown options when creating/editing a listing for `products.category` = `slug`.
 * Vehicles & Electronics: base + Foreign Used + Used.
 * Other categories: base + Used (no Foreign Used).
 */
export function getConditionOptionsForCategorySlug(slug: string): string[] {
  const base = [...BASE_PRODUCT_CONDITIONS];
  if (!slug.trim()) {
    return [...base, CONDITION_USED];
  }
  if (categorySlugShowsForeignUsed(slug)) {
    return [...base, CONDITION_FOREIGN_USED, CONDITION_USED];
  }
  return [...base, CONDITION_USED];
}

/**
 * Options for Home / Shop condition filter dropdown.
 * When no category is selected (“All”), show every label users can filter by.
 */
export function getConditionFilterDropdownOptions(categorySlug: string | null): string[] {
  if (categorySlug == null) {
    return [...BASE_PRODUCT_CONDITIONS, CONDITION_FOREIGN_USED, CONDITION_USED];
  }
  return getConditionOptionsForCategorySlug(categorySlug);
}

/** All values we may store or filter on (for validation / queries). */
export const ALL_KNOWN_PRODUCT_CONDITIONS: readonly string[] = [
  ...BASE_PRODUCT_CONDITIONS,
  CONDITION_FOREIGN_USED,
  CONDITION_USED,
];
