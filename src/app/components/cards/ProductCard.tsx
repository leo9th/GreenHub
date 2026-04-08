import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Star, MapPin, Heart, Eye } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import type {
  KeyboardEventHandler,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  ReactNode,
} from "react";

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
  rating,
  reviews,
  titleAdornment,
  topRightBadge,
  deliveryFee,
  productId,
  href,
  viewsCount,
  likesCount,
  liked,
  onLikeClick,
  likeDisabled,
  commentCount,
}: ProductCardProps) {
  const navigate = useNavigate();
  const [likeBursts, setLikeBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const burstIdRef = useRef(0);
  const lastTapRef = useRef(0);
  const navTimerRef = useRef<number | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);

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

  const clearNavTimer = () => {
    if (navTimerRef.current != null) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  };

  const goToHref = () => {
    if (href) navigate(href);
  };

  const spawnHeart = (clientX: number, clientY: number) => {
    const rect = imageRef.current?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    const id = ++burstIdRef.current;
    setLikeBursts((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setLikeBursts((prev) => prev.filter((b) => b.id !== id));
    }, 800);
  };

  const handleImageTap = (clientX: number, clientY: number, e: ReactMouseEvent | ReactTouchEvent) => {
    const now = Date.now();
    const isDouble = now - lastTapRef.current < 320;
    clearNavTimer();
    if (isDouble) {
      e.preventDefault();
      e.stopPropagation();
      spawnHeart(clientX, clientY);
      onLikeClick?.(e as unknown as ReactMouseEvent);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    navTimerRef.current = window.setTimeout(() => {
      goToHref();
      navTimerRef.current = null;
    }, 200);
  };

  const onImageClick = (e: ReactMouseEvent) => {
    if (!href) return;
    handleImageTap(e.clientX, e.clientY, e);
  };

  const onImageTouchEnd = (e: ReactTouchEvent) => {
    if (!href) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    handleImageTap(touch.clientX, touch.clientY, e);
  };

  const cardTabIndex = useMemo(() => (href ? 0 : -1), [href]);

  const onKeyNavigate: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!href) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToHref();
    }
  };

  return (
    <Card
      className="overflow-hidden group transition-all hover:shadow-md h-full flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      tabIndex={cardTabIndex}
      onKeyDown={onKeyNavigate}
      role={href ? "link" : undefined}
      aria-label={href ? `View ${title}` : undefined}
    >
      <div
        ref={imageRef}
        className="relative aspect-[16/9] overflow-hidden bg-gray-100 cursor-pointer select-none"
        onClick={onImageClick}
        onTouchEnd={onImageTouchEnd}
      >
        <img
          src={image}
          alt={title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
          draggable={false}
        />
        <Badge className={`absolute top-2 left-2 ${getConditionColor(condition)}`}>{condition}</Badge>
        {topRightBadge && <div className="absolute top-2 right-2">{topRightBadge}</div>}
        {likeBursts.map((burst) => (
          <span
            key={burst.id}
            className="pointer-events-none absolute text-red-500 drop-shadow-sm animate-[ping_0.8s_cubic-bezier(0,0,0.2,1)_1]"
            style={{ left: burst.x, top: burst.y, transform: "translate(-50%, -50%)" }}
            aria-hidden
          >
            <Heart className="w-8 h-8" />
          </span>
        ))}
      </div>
      <CardContent
        className="p-4 cursor-pointer"
        onClick={(e) => {
          if (!href) return;
          e.stopPropagation();
          goToHref();
        }}
      >
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
        {deliveryFee !== undefined && (
          <p className="text-xs text-gray-500 font-medium mt-2">
            + ₦{deliveryFee.toLocaleString()} delivery
          </p>
        )}
      </CardContent>
      {showEngagement ? (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-4 pb-4 pt-2 border-t border-gray-100 mt-auto">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="w-3.5 h-3.5 opacity-70" aria-hidden />
            {viewsCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToHref();
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:text-[#15803d] hover:bg-emerald-50"
              aria-label="Open product to view comments"
            >
              <span aria-hidden className="text-base leading-none">
                💬
              </span>
              <span className="tabular-nums">{commentCount ?? 0}</span>
            </button>
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
      ) : null}
    </Card>
  );
}
