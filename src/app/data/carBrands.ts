/**
 * Popular car brands in Nigeria (rough popularity order).
 * `value` is stored in `products.car_brand` for presets.
 * "Others" uses free-text in the same column (not the sentinel).
 */
export const NIGERIA_CAR_BRAND_OPTIONS = [
  { value: "Toyota", label: "Toyota" },
  { value: "Honda", label: "Honda" },
  { value: "Hyundai", label: "Hyundai (Elantra, Accent, Tucson)" },
  { value: "Kia", label: "Kia" },
  { value: "Nissan", label: "Nissan" },
  { value: "Mercedes-Benz", label: "Mercedes-Benz" },
  { value: "BMW", label: "BMW" },
  { value: "Lexus", label: "Lexus" },
  { value: "Ford", label: "Ford" },
  { value: "Volkswagen", label: "Volkswagen" },
  { value: "Mitsubishi", label: "Mitsubishi" },
  { value: "Mazda", label: "Mazda" },
  { value: "Chevrolet", label: "Chevrolet" },
  { value: "Peugeot", label: "Peugeot" },
  { value: "Suzuki", label: "Suzuki" },
  { value: "Jeep", label: "Jeep" },
  { value: "Land Rover", label: "Land Rover" },
  { value: "Audi", label: "Audi" },
  { value: "Subaru", label: "Subaru" },
  { value: "Volvo", label: "Volvo" },
  { value: "GAC", label: "GAC" },
  { value: "Geely", label: "Geely" },
  { value: "Changan", label: "Changan" },
  { value: "Chery", label: "Chery" },
] as const;

/** Select value that triggers manual brand entry on add-product form */
export const CAR_BRAND_SELECT_OTHER = "__other__";

export const NIGERIA_CAR_BRAND_PRESET_VALUES = NIGERIA_CAR_BRAND_OPTIONS.map((o) => o.value);

export function labelForCarBrandValue(value: string) {
  return NIGERIA_CAR_BRAND_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
