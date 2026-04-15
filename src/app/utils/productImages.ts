/** Max gallery images per product (aligned with Add Product UI). */
export const MAX_PRODUCT_IMAGES = 5;

/**
 * Normalize `products.images` (TEXT[] or JSON) plus legacy `image` into up to 5 public URLs.
 */
export function parseProductImagesArray(imagesRaw: unknown, fallbackImage?: unknown): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };

  if (Array.isArray(imagesRaw)) {
    for (const x of imagesRaw) {
      if (typeof x === "string") push(x);
    }
  } else if (typeof imagesRaw === "string") {
    const t = imagesRaw.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) {
          for (const x of p) {
            if (typeof x === "string") push(x);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (out.length === 0 && fallbackImage != null && typeof fallbackImage === "string" && fallbackImage.trim()) {
    push(fallbackImage);
  }

  return out.slice(0, MAX_PRODUCT_IMAGES);
}

export function parseProductImagesFromRow(row: { image?: unknown; images?: unknown }): string[] {
  return parseProductImagesArray(row.images, row.image);
}

export function getProductThumbnailUrl(row: { image?: unknown; images?: unknown }): string {
  const urls = parseProductImagesFromRow(row);
  return urls[0] ?? "";
}

const OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";

/**
 * Supabase Storage image transformation for listing thumbnails (smaller JPEG/WebP over the wire).
 * Non-Supabase URLs are returned unchanged.
 */
export function optimizeListingImageUrl(
  raw: string,
  opts: { width?: number; quality?: number } = {},
): string {
  const width = opts.width ?? 400;
  const quality = opts.quality ?? 70;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes("placehold.co")) return trimmed;
  const base = trimmed.split("?")[0] ?? trimmed;
  if (!base.includes(OBJECT_PUBLIC_SEGMENT)) return trimmed;
  const renderUrl = base.replace(OBJECT_PUBLIC_SEGMENT, "/storage/v1/render/image/public/");
  const sep = renderUrl.includes("?") ? "&" : "?";
  return `${renderUrl}${sep}width=${width}&quality=${quality}`;
}

const MARKER = (bucket: string) => `/object/public/${bucket}/`;

/** Extract storage object path from a single Supabase public URL, or null if not from this bucket. */
export function storagePathFromPublicUrl(raw: string, bucket: string): string | null {
  const url = raw.split("?")[0];
  const m = MARKER(bucket);
  const idx = url.indexOf(m);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + m.length));
  } catch {
    return null;
  }
}

/** All storage paths for a product’s images (for delete / cleanup). */
export function collectStoragePathsForProduct(
  row: { image?: string | null; images?: unknown },
  bucket: string,
): string[] {
  const urls = parseProductImagesFromRow(row);
  const paths = new Set<string>();
  for (const u of urls) {
    const p = storagePathFromPublicUrl(u, bucket);
    if (p) paths.add(p);
  }
  return [...paths];
}
