import { categories } from "../data/catalogConstants";
import { NIGERIA_CAR_BRAND_OPTIONS } from "../data/carBrands";
import { sanitizeSearchTerm } from "./productSearch";

/** Suggestions for "Related searches" / "Did you mean" (no network). */
export function getRelatedSearchSuggestions(rawTerm: string, max = 8): string[] {
  const t = sanitizeSearchTerm(rawTerm);
  if (t.length < 2) return [];
  const lower = t.toLowerCase();
  const out: string[] = [];
  const add = (s: string) => {
    const x = s.trim();
    if (!x || out.some((y) => y.toLowerCase() === x.toLowerCase())) return;
    out.push(x);
  };

  const titleCase =
    t.length > 0 ? t.charAt(0).toUpperCase() + (t.length > 1 ? t.slice(1).toLowerCase() : "") : t;
  add(t);
  if (titleCase.toLowerCase() !== lower) add(titleCase);

  for (const c of categories) {
    if (c.name.toLowerCase().includes(lower) || c.id.includes(lower) || lower.includes(c.id)) {
      add(c.name);
    }
  }

  for (const o of NIGERIA_CAR_BRAND_OPTIONS) {
    const shortLabel = o.label.split("(")[0].trim();
    if (
      o.value.toLowerCase().includes(lower) ||
      shortLabel.toLowerCase().includes(lower) ||
      lower.includes(o.value.toLowerCase())
    ) {
      add(o.value);
    }
  }

  const commonProducts = [
    "Laptop",
    "iPhone",
    "Samsung",
    "Fridge",
    "Generator",
    "Inverter",
    "Land",
    "Rent",
    "Bike",
    "Shoes",
  ];
  for (const p of commonProducts) {
    if (p.toLowerCase().includes(lower) || (lower.length >= 3 && p.toLowerCase().startsWith(lower))) add(p);
  }

  return out.slice(0, max);
}
