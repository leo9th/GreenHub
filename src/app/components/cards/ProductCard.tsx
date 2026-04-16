import { Link } from "react-router";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { MapPin } from "lucide-react";
import { useCurrency } from "../../hooks/useCurrency";
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
  state?: string;
  condition?: string;
  href?: string;
  commentCount?: number;
  viewCount?: number;
  viewsCount?: number;
  likeCount?: number;
  likesCount?: number;
  priceDisplay?: string;
  priceLocal?: number;
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
  /** Seller display name from `profiles.full_name` (no username column). */
  sellerName?: string;
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
  state,
  href,
  condition,
  priceDisplay,
  priceLocal,
  sellerName,
}: ProductCardProps) {
  const formatPrice = useCurrency();

  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null && String(productId).trim() !== ""
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const locationDisplay =
    (city?.trim() || state?.trim() || location?.trim() || "").trim() || "Location not specified";
  const sellerDisplay = sellerName?.trim() || "Seller";

  const firstFromImages =
    Array.isArray(images) && typeof images[0] === "string" ? images[0].trim() : "";
  const rawImage = image?.trim() || firstFromImages || PLACEHOLDER_IMG;
  const imageUrl = optimizeListingImageUrl(rawImage, { width: 400, quality: 70 });

  const displayPrice =
    typeof priceDisplay === "string" && priceDisplay.trim() !== ""
      ? priceDisplay
      : formatPrice(priceLocal ?? price);

  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/10">
      <Link
        to={linkTo}
        className="flex h-full flex-col text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        <div className="w-full h-72 overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
          {condition ? (
            <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              {condition}
            </div>
          ) : null}
        </div>

        <div className="flex flex-grow flex-col p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-gray-900 transition-colors group-hover:text-emerald-700">
            {title}
          </h3>
          <div className="mt-3 flex items-center gap-1 text-gray-500">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate text-xs">{locationDisplay}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">{sellerDisplay}</p>
          <div className="mt-auto pt-3">
            <div className="text-lg font-bold leading-none text-emerald-600">{displayPrice}</div>
            <div className="mt-2 flex items-center gap-1 text-gray-400">
              <MapPin size={12} />
              <span className="truncate text-[11px]">{city?.trim() || "Nigeria"}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
