import { Link } from "react-router";
import { useCurrency } from "../../hooks/useCurrency";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { VerifiedBadge } from "../VerifiedBadge";
import { VerifiedAdvertiserBadge } from "../VerifiedAdvertiserBadge";
import { derivePeerHandle } from "../chat/ChatPeerHeaderModern";

/**
 * Listing card — image uses fixed height (mobile/desktop); footer is below (no overlap).
 * Extra props are accepted so Home/Products/DesignSystem call sites stay type-compatible.
 *
 * Note: Do not nest <button> inside <Link> (<a>) — invalid HTML and breaks taps/clicks on some browsers.
 */
export interface ProductCardProps {
  id?: string;
  productId?: number | string;
  title: string;
  price: number;
  image?: string;
  /** `products.location` — preferred (e.g. “Garki, Abuja”). */
  location?: string;
  /** `products.city` — used when `location` is empty. */
  city?: string;
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
  /** Legacy: full name from profiles — used to derive @handle when `sellerUsername` is omitted. */
  sellerName?: string;
  /** Public @username (preferred over `sellerName` for display). */
  sellerUsername?: string;
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
  condition,
  href,
  commentCount,
  viewCount,
  viewsCount,
  likeCount,
  likesCount,
  sellerVerified,
  verifiedAdvertiser,
  titleAdornment,
  topRightBadge,
  sellerId,
  sellerFollowerCount,
  sellerName,
  sellerUsername,
  messageSellerHref,
}: ProductCardProps) {
  const formatPrice = useCurrency();
  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  /** DM deep link — callers can override via `messageSellerHref`. */
  const messageToSellerHref =
    messageSellerHref ??
    (sellerId && resolvedId
      ? `/messages/u/${encodeURIComponent(sellerId)}?product=${encodeURIComponent(resolvedId)}`
      : undefined);

  const displayViews = viewCount ?? viewsCount;
  const displayLikes = likeCount ?? likesCount;

  const locationDisplayText =
    location?.trim() || city?.trim() || "Location not specified";

  const sellerHandleLabel = (() => {
    const raw = sellerUsername?.trim();
    if (raw) return raw.startsWith("@") ? raw : `@${raw}`;
    const name = sellerName?.trim();
    if (name) return derivePeerHandle(name);
    return null;
  })();

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-transparent bg-white shadow-sm transition hover:shadow-md dark:border-border dark:bg-card">
      {/* Image: only the image is inside the listing <Link> — overlays stay outside (valid HTML). */}
      <div className="relative h-[min(200px,42vw)] w-full min-h-[140px] shrink-0 overflow-hidden bg-gray-100 dark:bg-muted sm:h-[160px] md:h-[200px]">
        <Link
          to={linkTo}
          className="absolute inset-0 z-0 block outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
          aria-label={`View listing: ${title}`}
        >
          <img
            src={image || "https://placehold.co/400x400/png?text=No+Image"}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </Link>
        {topRightBadge ? (
          <div className="pointer-events-none absolute right-2 top-2 z-[3] max-w-[45%]">{topRightBadge}</div>
        ) : null}
        {condition ? (
          <span className="pointer-events-none absolute left-2 top-2 z-[1] rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {condition}
          </span>
        ) : null}
        <div className="pointer-events-auto absolute bottom-2 right-2 z-[2] flex flex-col items-end gap-1">
          {sellerId && sellerFollowerCount !== undefined ? (
            <Link
              to={`/profile/${sellerId}/followers`}
              data-gh-pan-exempt
              className="flex min-h-[32px] min-w-[32px] touch-manipulation items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/75"
              aria-label="Seller followers"
              onClick={(e) => e.stopPropagation()}
            >
              👥 {sellerFollowerCount}
            </Link>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
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

      {/* Title / price / location: single link — no buttons inside */}
      <Link
        to={linkTo}
        className="flex min-h-0 shrink-0 flex-col gap-1 border-t border-gray-100 bg-white px-3 py-2 text-left no-underline transition-opacity hover:opacity-95 dark:border-border dark:bg-card"
      >
        <h3 className="flex flex-wrap items-start gap-1 text-sm font-semibold leading-snug text-gray-800 dark:text-card-foreground">
          <span className="line-clamp-2 min-w-0 flex-1">{title}</span>
          {titleAdornment}
          {sellerVerified ? <VerifiedBadge title="Verified seller" size="sm" className="mt-0.5 shrink-0" /> : null}
        </h3>
        {verifiedAdvertiser ? (
          <div className="flex flex-wrap gap-1">
            <VerifiedAdvertiserBadge size="sm" />
          </div>
        ) : null}
        <p className="text-base font-bold leading-tight text-green-600 dark:text-primary">{formatPrice(price)}</p>
        <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-muted-foreground">
          <span className="mt-0.5 shrink-0 select-none text-[13px] leading-none" aria-hidden>
            📍
          </span>
          <span className="min-w-0 break-words">{locationDisplayText}</span>
        </p>
      </Link>

      {sellerId ? (
        <div className="shrink-0 border-t border-gray-100 bg-white px-3 pb-2 pt-0 dark:border-border dark:bg-card">
          <Link
            to={`/profile/${sellerId}`}
            data-gh-pan-exempt
            className="flex w-full min-h-[44px] touch-manipulation items-center text-left text-xs font-medium text-[#15803d] hover:underline dark:text-emerald-400"
            onClick={(e) => e.stopPropagation()}
          >
            Seller · {sellerHandleLabel ?? "View profile"}
          </Link>
        </div>
      ) : null}

      {messageToSellerHref ? (
        <Link
          to={messageToSellerHref}
          data-gh-pan-exempt
          className="message-seller-link relative z-20 flex min-h-[48px] w-full shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-2 border-t border-gray-100 bg-emerald-50/90 px-3 py-3 text-center text-xs font-semibold text-[#15803d] no-underline transition hover:bg-emerald-100 active:bg-emerald-200 dark:border-border dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70 sm:py-2.5"
        >
          <span aria-hidden>💬</span>
          Message seller
        </Link>
      ) : null}
    </div>
  );
}

export default ProductCard;
