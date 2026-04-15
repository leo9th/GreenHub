import { Link } from "react-router";
import { useCurrency } from "../../hooks/useCurrency";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { derivePeerHandle } from "../chat/ChatPeerHeaderModern";

const PLACEHOLDER_IMG = "https://placehold.co/400x400/e5e7eb/9ca3af?text=No+Image";

/**
 * Minimal listing card: 3:4 aspect, 75% image / 25% text — image, title, price, location, @seller only.
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
  const imgSrc = (image?.trim() || firstFromImages || PLACEHOLDER_IMG) as string;

  return (
    <div className="product-card flex aspect-[3/4] w-full min-h-0 min-w-[160px] max-w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
      <Link
        to={linkTo}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        <div
          className="product-image relative shrink-0"
          style={{
            height: "75%",
            width: "100%",
            overflow: "hidden",
            backgroundColor: "#f3f4f6",
          }}
        >
          <img
            src={imgSrc}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
        </div>

        <div
          className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden border-t border-gray-100 bg-white dark:border-border dark:bg-card"
          style={{ padding: "8px 12px", gap: "2px", maxHeight: "25%" }}
        >
          <h3
            className="line-clamp-2 min-w-0 font-bold leading-tight text-gray-800 dark:text-card-foreground"
            style={{ fontSize: "0.875rem" }}
          >
            {title}
          </h3>
          <p className="min-w-0 font-bold leading-tight" style={{ fontSize: "0.875rem", color: "#10b981" }}>
            {formatPrice(price)}
          </p>
          <p
            className="line-clamp-1 min-w-0 leading-tight text-gray-500 dark:text-muted-foreground"
            style={{ fontSize: "0.75rem" }}
          >
            <span className="select-none" aria-hidden>
              📍{" "}
            </span>
            <span className="align-middle">{locationDisplay}</span>
          </p>
          {sellerLine ? (
            <p
              className="line-clamp-1 min-w-0 leading-tight text-gray-400 dark:text-zinc-500"
              style={{ fontSize: "0.75rem" }}
            >
              {sellerLine}
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
