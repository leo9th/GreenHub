import { Link } from "react-router";
import { Heart, Eye, MessageCircle } from "lucide-react";
import { useCurrency } from "../../hooks/useCurrency";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

export interface ProductCardProps {
  /** Prefer explicit id; falls back to `productId` for existing call sites */
  id?: string;
  title: string;
  price: number;
  image?: string;
  location?: string;
  condition?: string;
  href?: string;
  commentCount?: number;
  /** @deprecated Ignored — kept so listing pages compile without wide refactors */
  priceDisplay?: string;
  rating?: number;
  reviews?: number;
  titleAdornment?: ReactNode;
  topRightBadge?: ReactNode;
  deliveryFee?: number;
  productId?: number | string;
  viewsCount?: number;
  likesCount?: number;
  liked?: boolean;
  likeDisabled?: boolean;
  onLikeClick?: (e: ReactMouseEvent) => void;
}

export function ProductCard({
  id,
  title,
  price,
  image,
  location,
  condition,
  href,
  commentCount,
  productId,
  topRightBadge,
  titleAdornment,
  viewsCount,
  likesCount,
  liked,
  likeDisabled,
  onLikeClick,
}: ProductCardProps) {
  const formatPrice = useCurrency();
  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const hasValidProductId =
    productId != null &&
    (typeof productId === "number" ? Number.isFinite(productId) : String(productId).trim() !== "");

  const showEngagement =
    hasValidProductId &&
    (viewsCount !== undefined ||
      likesCount !== undefined ||
      commentCount !== undefined ||
      onLikeClick != null);

  return (
    <div className="grid h-full min-h-0 w-full min-w-0 aspect-[4/5] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative min-h-0 overflow-hidden bg-gray-100 select-none">
        <Link
          to={linkTo}
          aria-label={`View ${title}`}
          className="absolute inset-0 z-10 touch-manipulation"
        />
        <img
          src={image || "https://placehold.co/400x400/png?text=No+Image"}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {condition ? (
          <span className="absolute left-2 top-2 z-20 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {condition}
          </span>
        ) : null}
        {topRightBadge ? <div className="absolute right-2 top-2 z-20">{topRightBadge}</div> : null}
        {showEngagement ? (
          <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur">
              <Eye className="h-3.5 w-3.5 opacity-70" aria-hidden />
              <span className="tabular-nums">{viewsCount ?? 0}</span>
            </span>
            <div className="flex items-center gap-1">
              <Link
                to={linkTo}
                className="inline-flex touch-manipulation items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-[#15803d]"
                aria-label="Open product to view comments"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums">{commentCount ?? 0}</span>
              </Link>
              <button
                type="button"
                disabled={likeDisabled || !onLikeClick}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLikeClick?.(e);
                }}
                className={`inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur transition-colors disabled:opacity-40 ${
                  liked ? "text-red-600" : "text-gray-700 hover:bg-white hover:text-red-600"
                }`}
                aria-label={liked ? "Unlike" : "Like"}
              >
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                <span className="tabular-nums">{likesCount ?? 0}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="w-full min-w-0 shrink-0 border-t border-gray-100 bg-white p-6">
        <Link to={linkTo} className="block min-w-0 touch-manipulation rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-800">
                {title}
              </h3>
              {titleAdornment ? <span className="shrink-0">{titleAdornment}</span> : null}
            </div>
            <p className="m-0 text-base font-bold text-green-600">{formatPrice(price)}</p>
            {location ? (
              <p className="m-0 flex items-center gap-1 text-xs text-gray-600">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="truncate">{location}</span>
              </p>
            ) : null}
          </div>
        </Link>
      </div>
    </div>
  );
}

export default ProductCard;
