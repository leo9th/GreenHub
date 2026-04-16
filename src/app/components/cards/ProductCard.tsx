import { Link } from "react-router";
import { useEffect } from "react";
import { useCurrency } from "../../hooks/useCurrency";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { derivePeerHandle } from "../chat/ChatPeerHeaderModern";
import { VerifiedBadge } from "../VerifiedBadge";
import { optimizeListingImageUrl } from "../../utils/productImages";

const PLACEHOLDER_IMG = "https://placehold.co/400x400/e5e7eb/9ca3af?text=No+Image";

/**
 * Minimal listing card: fixed-height image, auto-height text — title, price, location, @seller only.
 * Extra props are accepted for call-site compatibility; social/boost/like UI is not rendered.
 */
export interface ProductCardProps {
  id?: string;
  productId?: number | string;
  title: string;
  price: number;
  image?: string;
  images?: string[];
  location?: string;
  city?: string;
  condition?: string;
  href?: string;
  commentCount?: number;
  viewCount?: number;
  viewsCount?: number;
  likeCount?: number;
  likesCount?: number;
  priceDisplay?: string;
  rating?: number;
  reviews?: number;
  sellerVerified?: boolean;
  verifiedAdvertiser?: boolean;
  titleAdornment?: ReactNode;
  topRightBadge?: ReactNode;
  deliveryFee?: number;
  liked?: boolean;
  likeDisabled?: boolean;
  onLikeClick?: (e: ReactMouseEvent) => void;
  sellerId?: string;
  sellerFollowerCount?: number;
  sellerName?: string;
  sellerUsername?: string;
  /** Sub-label from `profiles.verified_badge` (e.g. ID, Business) */
  verifiedSellerBadge?: string;
}

export function ProductCard({
  id,
  productId,
  title,
  price,
  image,
  images,
  location,
  city,
  href,
  sellerName,
  sellerUsername,
  sellerVerified,
  verifiedSellerBadge,
}: ProductCardProps) {
  const formatPrice = useCurrency();
  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const locationLine = (location?.trim() || city?.trim() || "").trim();
  const locationDisplay = locationLine || "—";

  const sellerLine = (() => {
    const raw = sellerUsername?.trim();
    if (raw) return raw.startsWith("@") ? raw : `@${raw}`;
    const name = sellerName?.trim();
    if (name) return derivePeerHandle(name);
    return null;
  })();

  const firstFromImages =
    Array.isArray(images) && images.length > 0 && typeof images[0] === "string" ? images[0].trim() : "";
  const rawForImg =
    (image?.trim() || firstFromImages || PLACEHOLDER_IMG) as string;
  const imgSrc = optimizeListingImageUrl(rawForImg, { width: 400, quality: 70 });

  useEffect(() => {
    console.log("Product image URL:", image, images?.[0]);
  }, [image, images]);

  return (
    <div className="product-card w-full min-w-[160px] max-w-full border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
      <Link
        to={linkTo}
        className="flex flex-col text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        <div className="product-image h-3/4 w-full overflow-hidden bg-gray-100">
          <img
            src={imgSrc}
            alt={title}
            className="w-full h-full object-contain"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
        </div>

        <div className="product-details border-t border-gray-100 dark:border-border">
          <h3
            className="line-clamp-2 min-w-0 font-bold leading-snug text-gray-800 dark:text-card-foreground"
            style={{ fontSize: "0.875rem" }}
          >
            {title}
          </h3>
          <p className="min-w-0 font-bold leading-tight" style={{ fontSize: "0.875rem", color: "#10b981" }}>
            {formatPrice(price)}
          </p>
          <p
            className="line-clamp-2 min-w-0 leading-snug text-gray-500 dark:text-muted-foreground"
            style={{ fontSize: "0.75rem" }}
          >
            <span className="select-none" aria-hidden>
              📍{" "}
            </span>
            <span className="align-middle">{locationDisplay}</span>
          </p>
          {sellerLine || sellerVerified ? (
            <p
              className="flex min-w-0 flex-wrap items-center gap-1 leading-snug text-gray-400 dark:text-zinc-500"
              style={{ fontSize: "0.75rem" }}
            >
              {sellerLine ? <span className="line-clamp-2 min-w-0">{sellerLine}</span> : null}
              {sellerVerified ? <VerifiedBadge title="Verified seller" size="sm" className="shrink-0" /> : null}
              {sellerVerified && verifiedSellerBadge ? (
                <span className="verified-badge shrink-0">{verifiedSellerBadge}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
