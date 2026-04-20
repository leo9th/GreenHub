import type { SupabaseClient } from "@supabase/supabase-js";
import { categories } from "../data/catalogConstants";

const STOPWORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "new",
    "used",
    "sale",
    "buy",
    "sell",
    "item",
    "items",
    "one",
    "two",
    "all",
    "any",
    "are",
    "was",
    "but",
    "not",
    "you",
    "your",
    "our",
    "has",
    "have",
    "per",
    "each",
    "set",
    "lot",
    "pcs",
    "piece",
    "pieces",
    "size",
    "color",
    "colour",
    "brand",
    "model",
    "free",
    "shipping",
    "delivery",
    "fast",
    "best",
    "good",
    "quality",
    "original",
    "full",
    "half",
    "mini",
    "large",
    "small",
    "medium",
    "xl",
    "xxl",
  ].map((w) => w.toLowerCase()),
);

export type SearchDictionaryEntry = {
  term: string;
  /** Human label when we inferred a dominant category for this term */
  categoryLabel?: string;
};

function categoryLabelForSlug(slug: string | null | undefined): string | undefined {
  if (!slug || typeof slug !== "string") return undefined;
  return categories.find((c) => c.id === slug)?.name;
}

function tokenizeTitle(title: string): string[] {
  const t = title.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
  if (!t) return [];
  return t
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Fetches recent active listings (titles + categories), derives the most common
 * meaningful tokens, and returns up to `limit` entries with optional category hints.
 * Single lightweight query; all aggregation is client-side.
 */
export async function fetchProductSearchDictionary(
  client: SupabaseClient,
  limit = 50,
): Promise<SearchDictionaryEntry[]> {
  const { data, error } = await client
    .from("products")
    .select("title, category")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) {
    return [];
  }

  type Acc = { count: number; byCat: Map<string, number> };
  const byTerm = new Map<string, Acc>();

  for (const row of data as { title?: unknown; category?: unknown }[]) {
    const title = typeof row.title === "string" ? row.title : "";
    const cat = typeof row.category === "string" ? row.category : "";
    const words = tokenizeTitle(title);
    const seen = new Set<string>();
    for (const w of words) {
      if (seen.has(w)) continue;
      seen.add(w);
      let acc = byTerm.get(w);
      if (!acc) {
        acc = { count: 0, byCat: new Map() };
        byTerm.set(w, acc);
      }
      acc.count += 1;
      if (cat) {
        acc.byCat.set(cat, (acc.byCat.get(cat) ?? 0) + 1);
      }
    }
  }

  const sorted = [...byTerm.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);

  return sorted.map(([term, acc]) => {
    let topSlug: string | undefined;
    let topN = 0;
    for (const [slug, n] of acc.byCat) {
      if (n > topN) {
        topN = n;
        topSlug = slug;
      }
    }
    const label = categoryLabelForSlug(topSlug);
    return {
      term,
      categoryLabel: label,
    };
  });
}
