import { Link } from "react-router";
import { memo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { MapPin, Star } from "lucide-react";
import { useCurrency } from "../../hooks/useCurrency";

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
  priceLocal?: number;
  rating?: number;
  reviews?: number;
  stockQuantity?: number | null;
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
  /** First viewport row: eager load for LCP */
  imagePriority?: boolean;
}

function ProductCardComponent({
  id,
  productId,
  title,
  price,
  image,
  images,
  location,
  city,
  href,
  condition,
  priceDisplay,
  priceLocal,
  sellerName,
  sellerUsername,
  sellerVerified,
  rating,
  reviews,
  stockQuantity,
  imagePriority,
}: ProductCardProps) {
  const formatPrice = useCurrency();
  const [imgLoaded, setImgLoaded] = useState(false);

  const resolvedId =
    id != null && String(id).trim() !== ""
      ? String(id)
      : productId != null && String(productId).trim() !== ""
        ? String(productId)
        : "";
  const linkTo = href || (resolvedId ? `/products/${resolvedId}` : "/products");

  const locationDisplay =
    (city?.trim() || location?.trim() || "").trim() || "Location not specified";
  const normalizedUsername = sellerUsername?.trim().replace(/^@+/, "");
  const sellerDisplay = normalizedUsername ? `@${normalizedUsername}` : sellerName?.trim() || "Seller";

  const firstFromImages =
    Array.isArray(images) && typeof images[0] === "string" ? images[0].trim() : "";
  const rawImage = image?.trim() || firstFromImages || PLACEHOLDER_IMG;
  const imageUrl = rawImage;

  const displayPrice =
    typeof priceDisplay === "string" && priceDisplay.trim() !== ""
      ? priceDisplay
      : formatPrice(priceLocal ?? price);
  const reviewCount = Number(reviews ?? 0);
  const ratingValue = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const productRatingLabel = reviewCount > 0 ? `${ratingValue.toFixed(1)} (${reviewCount})` : "";
  const stockLeft = Number.isFinite(Number(stockQuantity)) ? Number(stockQuantity) : null;
  const lowStock = stockLeft != null && stockLeft > 0 && stockLeft < 5;
  const soldOut = stockLeft === 0;

  return (
    <div className="group flex h-full w-full flex-col overflow-hidden rounded-none border border-slate-100/50 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl">
      <Link
        to={linkTo}
        className="flex h-full flex-col text-inherit no-underline outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        aria-label={`View listing: ${title}`}
      >
        {/* Image area: min height on small screens, flex-shrink-0 so parent flex never squashes the image */}
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: "100%",
            minHeight: "clamp(200px, 52vw, 280px)",
            height: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f3f4f6",
            position: "relative",
            borderRadius: "0",
          }}
        >
          {!imgLoaded ? (
            <div
              className="product-card-skeleton__image absolute inset-0 z-[1] rounded-none"
              aria-hidden
            />
          ) : null}
          <img
            src={imageUrl}
            alt={title}
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
            className="relative z-[2] max-h-[clamp(220px,72vw,360px)] w-full max-w-[800px] origin-center object-contain object-center transition-transform duration-300 ease-out group-hover:scale-105"
            style={{
              display: "block",
              height: "auto",
            }}
            loading={imagePriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "low"}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMG;
              setImgLoaded(true);
            }}
          />
          {condition && (
            <div
              style={{
                position: "absolute",
                left: "8px",
                top: "8px",
                backgroundColor: "rgba(255,255,255,0.8)",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: "bold",
                textTransform: "uppercase",
              }}
            >
              {condition}
            </div>
          )}
          {lowStock ? (
            <div className="absolute right-2 top-2 z-10 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
              Only {stockLeft} left!
            </div>
          ) : null}
          {soldOut ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center bg-white/20 py-2 backdrop-blur-md">
              <span className="rounded-full bg-[#15803d]/95 px-3 py-1 text-xs font-bold tracking-wide text-white">
                SOLD OUT
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
              <span className="inline-flex items-center gap-1 text-[11px] font-medium italic text-slate-400">
                {sellerDisplay}
                {sellerVerified ? (
                  <span
                    className="text-xs not-italic text-green-600"
                    title="Phone verified"
                    aria-label="Phone verified"
                  >
                    ✅
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          {reviewCount > 0 ? (
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
              <Star className="h-3 w-3 text-amber-400" />
              <span className="truncate">{productRatingLabel}</span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-bold text-green-600">{displayPrice}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

export const ProductCard = memo(ProductCardComponent);
export default ProductCard;