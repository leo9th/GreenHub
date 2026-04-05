import { Star, MapPin, Heart, Eye } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { ReactNode } from "react";

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
  productId?: number;
  viewsCount?: number;
  likesCount?: number;
  liked?: boolean;
  onLikeClick?: (e: React.MouseEvent) => void;
  likeDisabled?: boolean;
}

export function ProductCard({
  image,
  condition,
  title,
  price,
  priceDisplay,
  location,
  rating,
  reviews,
  titleAdornment,
  topRightBadge,
  deliveryFee,
  productId,
  viewsCount,
  likesCount,
  liked,
  onLikeClick,
  likeDisabled,
}: ProductCardProps) {
  const getConditionColor = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes("like") && c.includes("new")) return "bg-[#86efac] text-gray-800 hover:bg-[#22c55e] hover:text-white";
    if (c === "new" || c.startsWith("new")) return "bg-[#22c55e] hover:bg-[#16a34a]";
    if (c.includes("fair")) return "bg-gray-400 hover:bg-gray-500";
    if (c.includes("good")) return "bg-[#eab308] hover:bg-[#ca8a04]";
    return "bg-gray-200 text-gray-800";
  };

  const showEngagement =
    productId != null &&
    Number.isFinite(productId) &&
    (viewsCount !== undefined || likesCount !== undefined || onLikeClick != null);

  return (
    <Card className="overflow-hidden group transition-all hover:shadow-md h-full">
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
        <Badge className={`absolute top-2 left-2 ${getConditionColor(condition)}`}>{condition}</Badge>
        {topRightBadge && <div className="absolute top-2 right-2">{topRightBadge}</div>}
      </div>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] mb-2 leading-tight flex items-center gap-1">
          <span className="truncate">{title}</span>
          {titleAdornment}
        </h3>
        <p className="text-lg font-bold text-gray-900 mb-2">
          {priceDisplay ?? `₦${price.toLocaleString()}`}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[100px]">{location}</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-500 shrink-0">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-gray-700">{rating.toFixed(1)}</span>
            {reviews !== undefined && <span className="text-gray-400">({reviews})</span>}
          </div>
        </div>
        {showEngagement ? (
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="w-3.5 h-3.5 opacity-70" aria-hidden />
              {viewsCount ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={likeDisabled || !onLikeClick}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLikeClick?.(e);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mr-1 transition-colors disabled:opacity-40 ${
                  liked ? "text-red-600" : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                }`}
                aria-label={liked ? "Unlike" : "Like"}
              >
                <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
                <span className="tabular-nums">{likesCount ?? 0}</span>
              </button>
            </span>
          </div>
        ) : null }
        {deliveryFee !== undefined && (
          <p className="text-xs text-gray-500 font-medium mt-2">
            + ₦{deliveryFee.toLocaleString()} delivery
          </p>
        )}
      </CardContent>
    </Card>
  );
}
