import { Link } from "react-router";
import { Heart, Eye, MessageCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

export interface ProductCardProps {
  image: string;
  condition: string;
  title: string;
  price: number;
  priceDisplay?: string;
  location: string;
  rating: number;
  reviews?: number;
  titleAdornment?: ReactNode;
  topRightBadge?: ReactNode;
  deliveryFee?: number;
  productId?: number | string;
  href?: string;
  viewsCount?: number;
  likesCount?: number;
  liked?: boolean;
  onLikeClick?: (e: ReactMouseEvent) => void;
  likeDisabled?: boolean;
  commentCount?: number;
}

export function ProductCard({
  image,
  condition,
  title,
  price,
  priceDisplay,
  location,
  titleAdornment,
  topRightBadge,
  productId,
  href,
  viewsCount,
  likesCount,
  liked,
  onLikeClick,
  likeDisabled,
  commentCount,
}: ProductCardProps) {
  const getConditionColor = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes("like") && c.includes("new")) return "bg-[#86efac] text-gray-800 hover:bg-[#22c55e] hover:text-white";
    if (c === "new" || c.startsWith("new")) return "bg-[#22c55e] hover:bg-[#16a34a]";
    if (c.includes("fair")) return "bg-gray-400 hover:bg-gray-500";
    if (c.includes("good")) return "bg-[#eab308] hover:bg-[#ca8a04]";
    return "bg-gray-200 text-gray-800";
  };

  const hasValidProductId =
    productId != null &&
    (typeof productId === "number" ? Number.isFinite(productId) : String(productId).trim() !== "");

  const showEngagement =
    hasValidProductId &&
    (viewsCount !== undefined || likesCount !== undefined || commentCount !== undefined || onLikeClick != null);

  return (
    <Card
      className="grid h-full min-h-0 aspect-[4/5] grid-rows-[minmax(0,4fr)_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
    >
      <div className="relative min-h-0 overflow-hidden bg-gray-100 select-none">
        {href ? (
          <Link
            to={href}
            aria-label={`View ${title}`}
            className="absolute inset-0 z-10 touch-manipulation"
          />
        ) : null}
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover"
          draggable={false}
        />
        <Badge className={`absolute left-2 top-2 z-20 ${getConditionColor(condition)}`}>{condition}</Badge>
        {topRightBadge && <div className="absolute top-2 right-2 z-20">{topRightBadge}</div>}
        {showEngagement ? (
          <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur">
              <Eye className="h-3.5 w-3.5 opacity-70" aria-hidden />
              <span className="tabular-nums">{viewsCount ?? 0}</span>
            </span>
            <div className="flex items-center gap-1">
              {href ? (
                <Link
                  to={href}
                  className="inline-flex touch-manipulation items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-[#15803d]"
                  aria-label="Open product to view comments"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  <span className="tabular-nums">{commentCount ?? 0}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  <span className="tabular-nums">{commentCount ?? 0}</span>
                </span>
              )}
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
      <div className="flex min-h-0 flex-col justify-center overflow-hidden px-2.5 py-1.5 sm:px-3 sm:py-2">
        {href ? (
          <Link
            to={href}
            className="flex min-h-0 touch-manipulation flex-col justify-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:gap-1"
          >
            <div className="flex min-h-0 items-start gap-1">
              <h3 className="line-clamp-2 flex-1 text-[11px] font-medium leading-snug text-gray-900 sm:text-[13px] sm:leading-tight">
                {title}
              </h3>
              {titleAdornment}
            </div>
            <p className="truncate text-xs font-bold text-[#16a34a] sm:text-sm">
              {priceDisplay ?? `₦${price.toLocaleString()}`}
            </p>
            {location ? (
              <p className="truncate text-[10px] leading-tight text-gray-500 sm:text-[11px]">
                {location}
              </p>
            ) : null}
          </Link>
        ) : (
          <>
            <div className="flex min-h-0 items-start gap-1">
              <h3 className="line-clamp-2 flex-1 text-[11px] font-medium leading-snug text-gray-900 sm:text-[13px] sm:leading-tight">
                {title}
              </h3>
              {titleAdornment}
            </div>
            <p className="truncate text-xs font-bold text-[#16a34a] sm:text-sm">
              {priceDisplay ?? `₦${price.toLocaleString()}`}
            </p>
            {location ? (
              <p className="truncate text-[10px] leading-tight text-gray-500 sm:text-[11px]">
                {location}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
