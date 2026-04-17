import { useState } from "react";
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
  const [useContainFit, setUseContainFit] = useState(false);

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
    <div className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-100/50 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
      <Link
        to={linkTo}
        className="flex h-full flex-col text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
          <img
            src={imageUrl}
            alt={title}
            className={`h-full w-full object-center ${useContainFit ? "object-contain" : "object-cover"}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (!naturalWidth || !naturalHeight) return;
              const aspectRatio = naturalWidth / naturalHeight;
              // Extremely wide photos are better preserved with contain.
              setUseContainFit(aspectRatio >= 1.8);
            }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          {condition ? (
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur-md">
                {condition}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-grow flex-col justify-between p-4">
          <div>
            <h3 className="mb-1 line-clamp-1 text-base font-semibold text-slate-900">{title}</h3>

            <div className="mb-3 flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <MapPin size={12} className="shrink-0" />
                {locationDisplay}
              </span>
              <span className="text-[11px] font-medium italic text-slate-400">{sellerDisplay}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-green-600">{displayPrice}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
export default ProductCard;
