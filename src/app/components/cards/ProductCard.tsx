import { Link, useNavigate } from "react-router";
import { useCurrency } from "../../hooks/useCurrency";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { VerifiedBadge } from "../VerifiedBadge";
import { VerifiedAdvertiserBadge } from "../VerifiedAdvertiserBadge";

/**
 * Listing card — image uses fixed height (mobile/desktop); footer is below (no overlap).
 * Extra props are accepted so Home/Products/DesignSystem call sites stay type-compatible.
 */
export interface ProductCardProps {
  id?: string;
  productId?: number | string;
  title: string;
  price: number;
  image?: string;
  /** Primary area label (often state or “City, State”). */
  location?: string;
  /** Fallback when `location` is empty (some rows use `city` only). */
  city?: string;
  state?: string;
  lga?: string;
  condition?: string;
  href?: string;
  commentCount?: number;
  viewCount?: number;
  /** Alias for `viewCount` (listing pages) */
  viewsCount?: number;
  likeCount?: number;
  /** Alias for `likeCount` (listing pages) */
  likesCount?: number;
  /** @deprecated ignored — kept for compatibility */
  priceDisplay?: string;
  rating?: number;
  reviews?: number;
  /** Approved ID verification for listing seller */
  sellerVerified?: boolean;
  /** Paid boost / ads — profiles.is_verified_advertiser */
  verifiedAdvertiser?: boolean;
  titleAdornment?: ReactNode;
  topRightBadge?: ReactNode;
  deliveryFee?: number;
  liked?: boolean;
  likeDisabled?: boolean;
  onLikeClick?: (e: ReactMouseEvent) => void;
  /** Seller uuid — when set with `sellerFollowerCount`, shows a followers chip above the ❤️ row. */
  sellerId?: string;
  /** Loaded follower count for `sellerId` (omit until loaded). */
  sellerFollowerCount?: number;
  /** Seller display name from profiles (optional). */
  sellerName?: string;
  /** Opens DM with seller and this listing attached (`?product=`). Requires `sellerId`. */
  messageSellerHref?: string;
}

export function ProductCard({
  id,
  productId,
  title,
  price,
  image,
  location,
  city,
  state,
  lga,
  condition,
  href,
  commentCount,
  viewCount,
  viewsCount,
  likeCount,
  likesCount,
  sellerVerified,
  verifiedAdvertiser,
  sellerId,
  sellerFollowerCount,
  sellerName,
  messageSellerHref,
}: ProductCardProps) {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const displayViews = viewCount ?? viewsCount;
  const displayLikes = likeCount ?? likesCount;

  const locationLine = (() => {
    const loc = location?.trim();
    if (loc) return loc;
    const c = city?.trim();
    if (c) return c;
    const l = lga?.trim();
    const s = state?.trim();
    if (l && s) return `${l}, ${s}`;
    return l || s || "";
  })();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-transparent bg-white shadow-sm transition hover:shadow-md dark:border-border dark:bg-card">
    <Link
      to={linkTo}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Image ~75% of card height visually; fixed px so thumbnails stay large in narrow grids */}
      <div className="relative h-[160px] w-full shrink-0 overflow-hidden bg-gray-100 dark:bg-muted md:h-[200px]">
        <img
          src={image || "https://placehold.co/400x400/png?text=No+Image"}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {condition ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {condition}
          </span>
        ) : null}
        <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
          {sellerId && sellerFollowerCount !== undefined ? (
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/75"
              aria-label="Seller followers"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/profile/${sellerId}/followers`);
              }}
            >
              👥 {sellerFollowerCount}
            </button>
          ) : null}
          <div className="flex gap-2">
            {displayViews !== undefined && displayViews > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                👁 {displayViews}
              </span>
            ) : null}
            {displayLikes !== undefined && displayLikes > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                ❤️ {displayLikes}
              </span>
            ) : null}
            {commentCount !== undefined && commentCount > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                💬 {commentCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer — below image, compact spacing */}
      <div className="flex shrink-0 flex-col gap-1 border-t border-gray-100 dark:border-border bg-white dark:bg-card px-3 py-2">
        <h3 className="flex flex-wrap items-start gap-1 text-sm font-semibold leading-snug text-gray-800 dark:text-card-foreground">
          <span className="line-clamp-2 min-w-0 flex-1">{title}</span>
          {sellerVerified ? <VerifiedBadge title="Verified seller" size="sm" className="mt-0.5 shrink-0" /> : null}
        </h3>
        {verifiedAdvertiser ? (
          <div className="flex flex-wrap gap-1">
            <VerifiedAdvertiserBadge size="sm" />
          </div>
        ) : null}
        <p className="text-base font-bold leading-tight text-green-600 dark:text-primary">{formatPrice(price)}</p>
        {locationLine ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-muted-foreground">
            <span className="shrink-0 select-none text-[13px] leading-none" aria-hidden>
              📍
            </span>
            <span className="min-w-0">{locationLine}</span>
          </p>
        ) : null}
        {sellerId ? (
          <button
            type="button"
            className="w-full text-left text-xs font-medium text-[#15803d] hover:underline dark:text-emerald-400"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/profile/${sellerId}`);
            }}
          >
            Seller · {sellerName?.trim() || "View profile"}
          </button>
        ) : null}
      </div>
    </Link>
      {messageSellerHref ? (
        <Link
          to={messageSellerHref}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-gray-100 bg-emerald-50/90 px-3 py-2 text-xs font-semibold text-[#15803d] transition hover:bg-emerald-100 dark:border-border dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
        >
          <span aria-hidden>💬</span>
          Message seller
        </Link>
      ) : null}
    </div>
  );
}

export default ProductCard;
