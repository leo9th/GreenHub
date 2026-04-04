/** Stable per-tab-session seed so order doesn't flicker on every re-render */
function sessionMixSeed(): number {
  const key = "gh_feat_mix_seed";
  try {
    let s = sessionStorage.getItem(key);
    if (!s) {
      s = String(Math.floor(Math.random() * 1_000_000_000));
      sessionStorage.setItem(key, s);
    }
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 1;
  }
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const a = [...items];
  let t = seed >>> 0;
  const rnd = () => {
    t = (Math.imul(t, 1664525) + 1013904223) >>> 0;
    return t / 0xffffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reads featured listing IDs from localStorage (Setup Ad flow).
 * - `greenhub_featured_product`: single id
 * - `greenhub_featured_products`: JSON array or comma-separated ids
 */
export function getFeaturedProductIds(): Set<string> {
  const set = new Set<string>();
  try {
    const single = localStorage.getItem("greenhub_featured_product");
    if (single?.trim()) set.add(single.trim());

    const multi = localStorage.getItem("greenhub_featured_products");
    if (multi) {
      try {
        const parsed = JSON.parse(multi) as unknown;
        if (Array.isArray(parsed)) {
          for (const x of parsed) {
            if (x != null && x !== "") set.add(String(x).trim());
          }
        }
      } catch {
        for (const part of multi.split(",")) {
          const p = part.trim();
          if (p) set.add(p);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return set;
}

/**
 * Splits featured vs regular, shuffles featured order (seeded), then interleaves so
 * featured items are spread through the list (not clustered at the top).
 */
export function mixFeaturedProducts<T extends { id: unknown }>(products: T[], featuredIds: Set<string>): T[] {
  if (featuredIds.size === 0) return [...products];

  const featured: T[] = [];
  const regular: T[] = [];

  for (const p of products) {
    const idStr = p.id != null ? String(p.id) : "";
    if (idStr && featuredIds.has(idStr)) featured.push(p);
    else regular.push(p);
  }

  if (featured.length === 0) return [...products];
  if (regular.length === 0) return seededShuffle(featured, sessionMixSeed());

  const seed = sessionMixSeed();
  const f = seededShuffle(featured, seed ^ 0x9e3779b9);
  const r = regular;

  const out: T[] = [];
  let ri = 0;
  let fi = 0;
  const blocks = f.length + 1;
  const baseBetween = Math.floor(r.length / blocks);
  let remainder = r.length % blocks;

  const offset = blocks > 0 ? seed % Math.min(blocks, Math.max(1, r.length)) : 0;
  for (let i = 0; i < offset && ri < r.length; i++) out.push(r[ri++]);

  while (fi < f.length) {
    const take = baseBetween + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    for (let i = 0; i < take && ri < r.length; i++) out.push(r[ri++]);
    out.push(f[fi++]);
  }
  while (ri < r.length) out.push(r[ri++]);

  return out;
}
