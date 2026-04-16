import { Link } from "react-router";
import { useEffect } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCurrency } from "../../hooks/useCurrency";
import { derivePeerHandle } from "../chat/ChatPeerHeaderModern";
import { optimizeListingImageUrl } from "../../utils/productImages";

const PLACEHOLDER_IMG = "https://placehold.co/400x400/e5e7eb/9ca3af?text=No+Image";

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
}: ProductCardProps) {
  const formatPrice = useCurrency();

  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null && String(productId).trim() !== ""
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const locationDisplay = (location?.trim() || city?.trim() || "").trim() || "—";
  const sellerDisplay = (() => {
    const username = sellerUsername?.trim();
    if (username) return username.startsWith("@") ? username : `@${username}`;
    const name = sellerName?.trim();
    if (name) return derivePeerHandle(name);
    return "@seller";
  })();

  const firstFromImages =
    Array.isArray(images) && typeof images[0] === "string" ? images[0].trim() : "";
  const rawImage = image?.trim() || firstFromImages || PLACEHOLDER_IMG;
  const imageUrl = optimizeListingImageUrl(rawImage, { width: 400, quality: 70 });

  useEffect(() => {
    console.log("Product image URL:", image, images?.[0]);
  }, [image, images]);

  return (
    <div className="product-card w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <Link
        to={linkTo}
        className="flex h-full min-h-[320px] flex-col text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        <div className="h-3/4 w-full overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
        </div>

        <div className="flex h-1/4 flex-col gap-1 border-t border-gray-100 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{title}</h3>
          <p className="text-sm font-bold text-emerald-600">{formatPrice(price)}</p>
          <p className="line-clamp-1 text-xs text-gray-600">📍 {locationDisplay}</p>
          <p className="line-clamp-1 text-xs text-gray-500">{sellerDisplay}</p>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
