import React, { useState, useEffect, useCallback, useRef, type TouchEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Share2,
  Heart,
  Star,
  MapPin,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Shield,
  MessageCircle,
  Phone,
} from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getOrCreateAnonViewSession } from "../utils/viewSession";
import { toggleProductLike } from "../utils/engagement";
import { isOnlineFromLastActive, formatLastSeen } from "../utils/presence";
import { getAvatarUrl } from "../utils/getAvatar";
import { getProductPrice } from "../utils/getProductPrice";
import { activeProductsQuery, mapProductRow } from "../utils/productSearch";
import { getProductThumbnailUrl, parseProductImagesFromRow } from "../utils/productImages";
import { recordProductView } from "../utils/recentlyViewedProducts";
import { toast } from "sonner";
import { BoostDetailBadge } from "../components/BoostBadge";
import { getAuthSiteOrigin } from "../utils/authSiteUrl";
import { Textarea } from "../components/ui/textarea";

type ParsedDeliveryOption = { name: string; fee: number; duration: string };

function parseDeliveryOptionsFromDb(raw: unknown): ParsedDeliveryOption[] {
  if (raw == null) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) arr = p;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  const out: ParsedDeliveryOption[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) out.push({ name, fee: 0, duration: "" });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : String(o.name ?? "").trim();
      if (!name) continue;
      const feeRaw = o.fee;
      const feeNum = typeof feeRaw === "number" && Number.isFinite(feeRaw) ? feeRaw : Number(feeRaw);
      out.push({
        name,
        fee: Number.isFinite(feeNum) ? feeNum : 0,
        duration: typeof o.duration === "string" ? o.duration : String(o.duration ?? ""),
      });
    }
  }
  return out;
}

function shuffleRelatedProducts<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const DEFAULT_DOCUMENT_TITLE = "GreenHub - Buy & Sell in Nigeria";
const DEFAULT_META_DESCRIPTION =
  "GreenHub is Nigeria's premier C2C marketplace to buy and sell electronics, fashion, and goods securely.";
const COMMENTS_PAGE_SIZE = 10;

function upsertHeadMeta(attr: "property" | "name", key: string, content: string) {
  const selector = attr === "property" ? `meta[property="${key}"]` : `meta[name="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function applyHomePageMeta(origin: string) {
  const base = origin.replace(/\/$/, "");
  const defaultUrl = `${base}/`;
  const defaultImage = `${base}/favicon.svg`;
  document.title = DEFAULT_DOCUMENT_TITLE;
  upsertHeadMeta("property", "og:type", "website");
  upsertHeadMeta("property", "og:url", defaultUrl);
  upsertHeadMeta("property", "og:title", DEFAULT_DOCUMENT_TITLE);
  upsertHeadMeta("property", "og:description", DEFAULT_META_DESCRIPTION);
  upsertHeadMeta("property", "og:image", defaultImage);
  upsertHeadMeta("name", "twitter:card", "summary_large_image");
  upsertHeadMeta("name", "twitter:url", defaultUrl);
  upsertHeadMeta("name", "twitter:title", DEFAULT_DOCUMENT_TITLE);
  upsertHeadMeta("name", "twitter:description", DEFAULT_META_DESCRIPTION);
  upsertHeadMeta("name", "twitter:image", defaultImage);
}

type RelatedCarouselItem = {
  id: string | number;
  title: string;
  image: string;
  price: number;
  location: string;
  condition: string;
};

type SellerProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
  state: string | null;
  lga: string | null;
  created_at: string | null;
  phone?: string | null;
  last_active?: string | null;
};

type SellerReviewPreview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
};

type ProductReviewDisplay = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  reviewer_name: string;
  reviewer_avatar: string;
};

type ProductCommentDisplay = {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  like_count: number;
  user_name: string;
  user_avatar: string;
  liked_by_me: boolean;
};

function ProductDetailErrorBoundary({ children }: { children: React.ReactNode }) {
  class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
      const debugSnapshot =
        typeof window !== "undefined"
          ? (window as Window & { __GREENHUB_PRODUCTDETAIL_DEBUG__?: unknown }).__GREENHUB_PRODUCTDETAIL_DEBUG__
          : undefined;
      // eslint-disable-next-line no-console
      console.error("ProductDetail Error:", error.message);
      // eslint-disable-next-line no-console
      console.error("Error stack:", error.stack);
      // eslint-disable-next-line no-console
      console.error("Component stack:", info.componentStack);
      // eslint-disable-next-line no-console
      console.error("ProductDetail debug snapshot:", {
        href: typeof window !== "undefined" ? window.location.href : "",
        debugSnapshot,
      });
    }
    render() {
      if (this.state.error) {
        return (
          <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="max-w-md text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Product page hit a problem</h2>
              <p className="text-sm text-gray-600 mb-6">
                We couldn't render this listing fully. Please reload or go back and open it again.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-medium hover:bg-[#15803d]"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return <Boundary>{children}</Boundary>;
}

function RelatedProductsCarousel({
  items,
  formatPrice,
}: {
  items: RelatedCarouselItem[];
  formatPrice: (amount: number | null | undefined) => string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      duration: 30,
      dragFree: false,
    },
    [],
  );
  const [isHovering, setIsHovering] = useState(false);
  const pauseUntilRef = useRef(0);

  const bumpNavPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + 10000;
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
  }, [emblaApi, items]);

  useEffect(() => {
    if (!emblaApi || items.length === 0) return;
    const tick = window.setInterval(() => {
      if (isHovering) return;
      if (Date.now() < pauseUntilRef.current) return;
      emblaApi.scrollNext();
    }, 5000);
    return () => window.clearInterval(tick);
  }, [emblaApi, items.length, isHovering]);

  const scrollPrev = () => {
    bumpNavPause();
    emblaApi?.scrollPrev();
  };

  const scrollNext = () => {
    bumpNavPause();
    emblaApi?.scrollNext();
  };

  const safeItems = items.filter(
    (item): item is RelatedCarouselItem =>
      Boolean(item) && typeof item === "object" && "id" in item && item.id != null,
  );

  if (safeItems.length === 0) return null;

  return (
    <div
      className="relative -mx-1 sm:mx-0"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="overflow-hidden sm:rounded-xl" ref={emblaRef}>
        <div className="flex -ml-3 sm:-ml-4 touch-pan-x">
          {safeItems.map((item) => (
            <div
              key={String(item.id)}
              className="min-w-0 shrink-0 grow-0 pl-3 sm:pl-4 basis-[220px] w-[220px] max-w-[220px]"
            >
              <Link
                to={`/products/${item.id}`}
                className="group block rounded-xl overflow-hidden bg-gray-50/80 ring-1 ring-gray-100 hover:ring-[#22c55e]/35 transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200" aria-hidden />
                  )}
                  <span className="absolute top-2 left-2 bg-[#16a34a] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    {item.condition || "—"}
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-medium text-gray-900 mb-1 line-clamp-2 leading-snug group-hover:text-[#15803d]">
                    {item.title}
                  </h3>
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{formatPrice(item.price)}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {safeItems.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous related products"
            onClick={scrollPrev}
            className="absolute left-0 top-[62px] z-10 -translate-x-1 sm:-translate-x-2 w-9 h-9 rounded-full bg-white shadow-md ring-1 ring-gray-200/80 flex items-center justify-center text-gray-800 hover:bg-gray-50 hover:text-[#15803d]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next related products"
            onClick={scrollNext}
            className="absolute right-0 top-[62px] z-10 translate-x-1 sm:translate-x-2 w-9 h-9 rounded-full bg-white shadow-md ring-1 ring-gray-200/80 flex items-center justify-center text-gray-800 hover:bg-gray-50 hover:text-[#15803d]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function ProductDetailContent() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id ?? null;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryTouchStartX = useRef<number | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef(0);
  const tapHeartIdRef = useRef(0);
  const [tapHearts, setTapHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<SellerProfileRow | null>(null);
  const [sellerReviewAvg, setSellerReviewAvg] = useState(0);
  const [sellerReviewCount, setSellerReviewCount] = useState(0);
  const [sellerReviewsPreview, setSellerReviewsPreview] = useState<SellerReviewPreview[]>([]);
  const [sellerIdVerified, setSellerIdVerified] = useState(false);
  const [sellerInfoReady, setSellerInfoReady] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const phoneMenuRef = useRef<HTMLDivElement>(null);
  const [serverProduct, setServerProduct] = useState<any>(null);
  const [isServerProductLoading, setIsServerProductLoading] = useState<boolean>(true);
  const [relatedProducts, setRelatedProducts] = useState<RelatedCarouselItem[]>([]);
  const [moreFromSeller, setMoreFromSeller] = useState<RelatedCarouselItem[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReviewDisplay[]>([]);
  const [productReviewsReady, setProductReviewsReady] = useState(false);
  const [comments, setComments] = useState<ProductCommentDisplay[]>([]);
  const [commentsReady, setCommentsReady] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());
  const commentsLengthRef = useRef(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const zoomPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const zoomLastDistanceRef = useRef<number | null>(null);
  const zoomScaleRef = useRef(1);
  const singleTapTimerRef = useRef<number | null>(null);

  /** URL `products/:id` — pass through trimmed string so PostgREST matches int/bigint/uuid PKs without Number() precision loss */
  const normalizeRouteProductId = (raw: string | undefined): string | null => {
    if (raw == null) return null;
    const t = raw.trim();
    return t || null;
  };

  const foundProduct = serverProduct;

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __GREENHUB_PRODUCTDETAIL_DEBUG__?: Record<string, unknown> }).__GREENHUB_PRODUCTDETAIL_DEBUG__ = {
      routeId: id ?? null,
      productId: foundProduct?.id ?? null,
      sellerId: foundProduct?.seller_id ?? foundProduct?.sellerId ?? null,
      isServerProductLoading,
      commentsReady,
      commentsLoading,
      commentsCount: comments.length,
      productReviewsReady,
      productReviewsCount: productReviews.length,
    };
  }, [
    comments.length,
    commentsLoading,
    commentsReady,
    foundProduct?.id,
    foundProduct?.sellerId,
    foundProduct?.seller_id,
    id,
    isServerProductLoading,
    productReviews.length,
    productReviewsReady,
  ]);

  useEffect(() => {
    const origin = getAuthSiteOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
    if (!origin) return;

    if (isServerProductLoading) return;

    if (!serverProduct?.id) {
      applyHomePageMeta(origin);
      return;
    }

    const titleStr =
      typeof serverProduct.title === "string" ? serverProduct.title : String(serverProduct.title ?? "Listing");
    const descRaw = typeof serverProduct.description === "string" ? serverProduct.description : "";
    const desc = (descRaw.slice(0, 160).trim() || DEFAULT_META_DESCRIPTION).replace(/\s+/g, " ");

    const pid = String(serverProduct.id);
    const base = origin.replace(/\/$/, "");
    const pageUrl = `${base}/products/${pid}`;
    const thumb = getProductThumbnailUrl(serverProduct as { image?: unknown; images?: unknown }).trim();
    const ogImageUrl =
      thumb && /^https?:\/\//i.test(thumb)
        ? thumb
        : thumb
          ? `${base}${thumb.startsWith("/") ? thumb : `/${thumb}`}`
          : `${base}/favicon.svg`;

    document.title = `${titleStr} | GreenHub`;
    upsertHeadMeta("property", "og:type", "website");
    upsertHeadMeta("property", "og:url", pageUrl);
    upsertHeadMeta("property", "og:title", `${titleStr} | GreenHub`);
    upsertHeadMeta("property", "og:description", desc);
    upsertHeadMeta("property", "og:image", ogImageUrl);
    upsertHeadMeta("name", "twitter:card", "summary_large_image");
    upsertHeadMeta("name", "twitter:image", ogImageUrl);
    upsertHeadMeta("name", "twitter:title", `${titleStr} | GreenHub`);
    upsertHeadMeta("name", "twitter:description", desc);

    return () => {
      const o = getAuthSiteOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
      if (o) applyHomePageMeta(o);
    };
  }, [serverProduct, isServerProductLoading]);

  useEffect(() => {
    if (!foundProduct) return;
    const imgs = parseProductImagesFromRow(foundProduct as { image?: unknown; images?: unknown });
    setCurrentImageIndex((i) => (imgs.length === 0 ? 0 : Math.min(Math.max(0, i), imgs.length - 1)));
  }, [foundProduct?.id, foundProduct?.image, foundProduct?.images]);

  useEffect(() => {
    if (!serverProduct?.id) return;
    const pid = serverProduct.id;
    const asNum = typeof pid === "number" ? pid : Number(pid);
    if (!Number.isFinite(asNum)) return;
    const anon = getOrCreateAnonViewSession();
    void supabase
      .rpc("record_product_view", { p_product_id: asNum, p_anon_session: anon || null })
      .then(async ({ error }) => {
        if (error) {
          console.warn("record_product_view:", error.message);
          return;
        }
        const { data } = await supabase.from("products").select("views, like_count").eq("id", asNum).maybeSingle();
        if (data) {
          setServerProduct((prev) =>
            prev
              ? {
                  ...prev,
                  views: data.views as number,
                  like_count: data.like_count as number,
                }
              : prev,
          );
        }
      });
  }, [serverProduct?.id]);

  useEffect(() => {
    if (!authUserId || !serverProduct?.id) {
      setLiked(false);
      return;
    }
    const asNum = typeof serverProduct.id === "number" ? serverProduct.id : Number(serverProduct.id);
    if (!Number.isFinite(asNum)) return;
    let cancelled = false;
    void supabase
      .from("product_likes")
      .select("product_id")
      .eq("product_id", asNum)
      .eq("user_id", authUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setLiked(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [authUserId, serverProduct?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadProductReviews = async () => {
      const pid = serverProduct?.id;
      if (pid == null) {
        setProductReviews([]);
        setProductReviewsReady(true);
        return;
      }
      const pidNum = typeof pid === "number" ? pid : Number(pid);
      if (!Number.isFinite(pidNum)) {
        setProductReviews([]);
        setProductReviewsReady(true);
        return;
      }

      setProductReviewsReady(false);
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, created_at, user_id")
        .eq("product_id", pidNum)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (!(msg.includes("product_reviews") && msg.includes("does not exist"))) {
          console.warn("ProductDetail product_reviews:", error.message);
        }
        setProductReviews([]);
        setProductReviewsReady(true);
        return;
      }

      const rows = (data ?? []) as {
        id: string;
        rating: number;
        comment: string;
        created_at: string;
        user_id: string;
      }[];
      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      type ProfLite = { id: string; full_name: string | null; avatar_url: string | null; gender: string | null };
      let profMap = new Map<string, ProfLite>();
      if (uids.length > 0) {
        const { data: pubs } = await supabase
          .from("profiles_public")
          .select("id, full_name, avatar_url, gender")
          .in("id", uids);
        for (const p of (pubs ?? []) as ProfLite[]) {
          if (p.id) profMap.set(String(p.id), p);
        }
      }

      setProductReviews(
        rows.map((r) => {
          const pr = profMap.get(String(r.user_id));
          const name = pr?.full_name?.trim() || "Member";
          return {
            id: r.id,
            rating: Number(r.rating),
            comment: String(r.comment ?? ""),
            created_at: r.created_at,
            user_id: r.user_id,
            reviewer_name: name,
            reviewer_avatar: getAvatarUrl(pr?.avatar_url ?? null, pr?.gender ?? null, name),
          };
        }),
      );
      setProductReviewsReady(true);
    };

    void loadProductReviews();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadServerProduct = async () => {
      const idForQuery = normalizeRouteProductId(id);
      if (idForQuery == null) {
        setServerProduct(null);
        setIsServerProductLoading(false);
        setSellerInfoReady(true);
        return;
      }

      setIsServerProductLoading(true);
      setServerProduct(null);
      setSellerProfile(null);
      setSellerReviewAvg(0);
      setSellerReviewCount(0);
      setSellerReviewsPreview([]);
      setSellerIdVerified(false);
      setSellerInfoReady(false);

      const { data, error } = await supabase.from("products").select("*").eq("id", idForQuery).maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("ProductDetail loadServerProduct failed:", {
          routeId: idForQuery,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setServerProduct(null);
        setIsServerProductLoading(false);
        setSellerInfoReady(true);
        return;
      }

      if (data) {
        const v = data.views;
        const viewsNum = typeof v === "number" ? v : v != null ? Number(v) : 0;
        recordProductView(data.id);
        setServerProduct({
          ...data,
          price: getProductPrice(data),
          views: Number.isFinite(viewsNum) ? viewsNum : 0,
          sellerId: data.seller_id,
          sellerTier: data.seller_tier,
          deliveryOptions: data.delivery_options,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
        console.info("ProductDetail loaded product:", {
          routeId: idForQuery,
          productId: data.id ?? null,
          sellerId: data.seller_id ?? null,
          hasImage: data.image != null,
          imageCount: parseProductImagesFromRow(data as { image?: unknown; images?: unknown }).length,
        });
      } else {
        console.warn("ProductDetail no product found for route:", idForQuery);
        setServerProduct(null);
      }

      setIsServerProductLoading(false);
    };

    void loadServerProduct();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadRelated = async () => {
      if (!serverProduct?.id) {
        setRelatedProducts([]);
        return;
      }
      const raw =
        typeof serverProduct.category === "string" ? serverProduct.category.replace(/"/g, "").trim() : "";
      if (!raw) {
        setRelatedProducts([]);
        return;
      }

      let q = activeProductsQuery(supabase).neq("id", serverProduct.id).ilike("category", raw);
      const sellerId = serverProduct.seller_id ?? serverProduct.sellerId;
      if (sellerId != null && String(sellerId) !== "") {
        q = q.neq("seller_id", sellerId);
      }
      const { data, error } = await q.limit(12);

      if (cancelled) return;
      if (error) {
        console.warn("Related products:", error.message);
        setRelatedProducts([]);
        return;
      }

      const rows = (data ?? []).map((r) => mapProductRow(r as Record<string, unknown>));
      const mapped = rows.map((r) => ({
        id: r.id as string | number,
        title: String((r as { title?: string }).title ?? ""),
        image: getProductThumbnailUrl(r as Record<string, unknown>),
        price: typeof r.price === "number" ? r.price : getProductPrice(r as { price?: unknown; price_local?: unknown }),
        location: String((r as { location?: string }).location ?? ""),
        condition: String((r as { condition?: string }).condition ?? "Like New"),
      }));
      setRelatedProducts(shuffleRelatedProducts(mapped));
    };

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.id, serverProduct?.category, serverProduct?.seller_id, serverProduct?.sellerId]);

  useEffect(() => {
    let cancelled = false;

    const loadSellerListings = async () => {
      if (!serverProduct?.id) {
        setMoreFromSeller([]);
        return;
      }
      const sellerId = serverProduct.seller_id ?? serverProduct.sellerId;
      if (sellerId == null || String(sellerId) === "") {
        setMoreFromSeller([]);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .eq("seller_id", sellerId)
        .neq("id", serverProduct.id)
        .order("created_at", { ascending: false })
        .limit(16);

      if (cancelled) return;
      if (error) {
        console.warn("More from seller:", error.message);
        setMoreFromSeller([]);
        return;
      }

      const rows = (data ?? []).map((r) => mapProductRow(r as Record<string, unknown>));
      setMoreFromSeller(
        rows.map((r) => ({
          id: r.id as string | number,
          title: String((r as { title?: string }).title ?? ""),
          image: getProductThumbnailUrl(r as Record<string, unknown>),
          price: typeof r.price === "number" ? r.price : getProductPrice(r as { price?: unknown; price_local?: unknown }),
          location: String((r as { location?: string }).location ?? ""),
          condition: String((r as { condition?: string }).condition ?? "Like New"),
        })),
      );
    };

    void loadSellerListings();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.id, serverProduct?.seller_id, serverProduct?.sellerId]);

  useEffect(() => {
    let cancelled = false;
    const rawSid = serverProduct?.seller_id ?? serverProduct?.sellerId;
    if (rawSid == null || String(rawSid).trim() === "") {
      setSellerProfile(null);
      setSellerReviewAvg(0);
      setSellerReviewCount(0);
      setSellerReviewsPreview([]);
      setSellerIdVerified(false);
      setSellerInfoReady(true);
      return;
    }
    const idStr = String(rawSid).trim();

    const loadSellerContext = async () => {
      setSellerInfoReady(false);

      const [profRes, ratingsRes, previewRes, verRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, gender, state, lga, created_at, phone, last_active")
          .eq("id", idStr)
          .maybeSingle(),
        supabase.from("seller_reviews").select("rating").eq("seller_id", idStr),
        supabase
          .from("seller_reviews")
          .select("id, rating, comment, created_at, reviewer_id")
          .eq("seller_id", idStr)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("seller_verification").select("id").eq("seller_id", idStr).eq("status", "approved").limit(1).maybeSingle(),
      ]);

      if (cancelled) return;

      let prof: SellerProfileRow | null = profRes.data ? (profRes.data as SellerProfileRow) : null;
      if (profRes.error && !String(profRes.error.message || "").toLowerCase().includes("row")) {
        console.warn("ProductDetail profiles:", profRes.error.message);
      }
      if (!prof) {
        const pub = await supabase
          .from("profiles_public")
          .select("id, full_name, avatar_url, gender, state, lga, created_at, last_active, phone")
          .eq("id", idStr)
          .maybeSingle();
        if (cancelled) return;
        if (pub.data) prof = pub.data as SellerProfileRow;
      }

      if (cancelled) return;
      setSellerProfile(prof);

      const ratingRows = (ratingsRes.data ?? []) as { rating: number }[];
      const rErr = ratingsRes.error;
      if (rErr && !String(rErr.message).includes("permission") && rErr.code !== "42501") {
        console.warn("ProductDetail seller reviews:", rErr.message);
      }
      const cnt = ratingRows.length;
      const avg = cnt > 0 ? ratingRows.reduce((s, r) => s + Number(r.rating), 0) / cnt : 0;
      setSellerReviewCount(cnt);
      setSellerReviewAvg(avg);

      const previewRows = (previewRes.data ?? []) as {
        id: string;
        rating: number;
        comment: string;
        created_at: string;
        reviewer_id: string;
      }[];
      const reviewerIds = [...new Set(previewRows.map((r) => r.reviewer_id))];
      const nameMap = new Map<string, string>();
      if (reviewerIds.length > 0) {
        const { data: nameRows } = await supabase.from("profiles_public").select("id, full_name").in("id", reviewerIds);
        if (cancelled) return;
        for (const p of nameRows ?? []) {
          if (p.id) nameMap.set(String(p.id), String((p.full_name as string) || "").trim() || "Buyer");
        }
      }

      if (cancelled) return;
      setSellerReviewsPreview(
        previewRows.map((r) => ({
          ...r,
          reviewer_name: nameMap.get(r.reviewer_id) || "Buyer",
        })),
      );

      setSellerIdVerified(Boolean(verRes.data) && !verRes.error);
      setSellerInfoReady(true);
    };

    void loadSellerContext();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.seller_id, serverProduct?.sellerId]);

  useEffect(() => {
    if (!phoneMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (phoneMenuRef.current && !phoneMenuRef.current.contains(e.target as Node)) {
        setPhoneMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [phoneMenuOpen]);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  useEffect(() => {
    return () => cancelSingleTapZoom();
  }, []);

  useEffect(() => {
    commentsLengthRef.current = comments.length;
  }, [comments.length]);

  if (isServerProductLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!foundProduct || foundProduct.id == null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Product not found</h2>
          <p className="text-gray-600 text-sm mb-6">The product you&apos;re looking for doesn&apos;t exist.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-[#16a34a] text-white rounded-lg text-sm font-medium hover:bg-[#15803d]"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  /** Always use DB `seller_id` (uuid) for chat, profile, and lookups. */
  const sellerPeerIdRaw = foundProduct.seller_id ?? foundProduct.sellerId;
  const sellerPeerId =
    sellerPeerIdRaw != null && String(sellerPeerIdRaw).trim() !== "" ? String(sellerPeerIdRaw).trim() : "";
  const canMessageSeller = Boolean(sellerPeerId);

  const galleryImages = parseProductImagesFromRow(foundProduct as { image?: unknown; images?: unknown });

  const sellerDisplayName =
    sellerProfile?.full_name?.trim() ||
    (sellerInfoReady ? "Seller" : "…");
  const listingRatingRaw = Number(foundProduct.rating);
  const listingReviewsRaw = Number(foundProduct.reviews);
  const hasAggregateReviews = sellerReviewCount > 0;
  const displaySellerRating = hasAggregateReviews
    ? Math.round(sellerReviewAvg * 10) / 10
    : Number.isFinite(listingRatingRaw) && listingReviewsRaw > 0
      ? Math.round(listingRatingRaw * 10) / 10
      : 0;
  const displaySellerReviewCount = hasAggregateReviews
    ? sellerReviewCount
    : Number.isFinite(listingReviewsRaw)
      ? Math.max(0, Math.floor(listingReviewsRaw))
      : 0;

  const sellerTierRaw =
    typeof foundProduct.seller_tier === "string"
      ? foundProduct.seller_tier
      : typeof foundProduct.sellerTier === "string"
        ? foundProduct.sellerTier
        : "";
  const sellerTierLower = sellerTierRaw.toLowerCase();

  const likeCount = Number(foundProduct.like_count ?? 0);
  const sellerOnline = isOnlineFromLastActive(sellerProfile?.last_active);

  const spawnTapHeart = (clientX: number, clientY: number) => {
    const rect = galleryRef.current?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    const id = ++tapHeartIdRef.current;
    setTapHearts((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setTapHearts((prev) => prev.filter((h) => h.id !== id));
    }, 850);
  };

  const handleDoubleTapLike = (clientX: number, clientY: number) => {
    if (isServerProductLoading || foundProduct?.id == null) return;
    spawnTapHeart(clientX, clientY);
    if (likeBusy) return;
    void handleToggleLike();
  };

  const handleToggleLike = async () => {
    if (isServerProductLoading || foundProduct?.id == null) {
      toast.message("Listing is still loading.");
      return;
    }
    if (!authUserId) {
      toast.message("Sign in to like this listing");
      navigate("/login");
      return;
    }
    const asNum = typeof foundProduct.id === "number" ? foundProduct.id : Number(foundProduct.id);
    if (!Number.isFinite(asNum)) return;
    setLikeBusy(true);
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setServerProduct((p) =>
      p
        ? {
            ...p,
            like_count: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
          }
        : p,
    );
    const { error } = await toggleProductLike(supabase, asNum, authUserId, wasLiked);
    setLikeBusy(false);
    if (error) {
      toast.error(error);
      setLiked(wasLiked);
      setServerProduct((p) => (p ? { ...p, like_count: prevCount } : p));
    }
  };

  const clampScale = (value: number) => Math.min(4, Math.max(1, value));

  const resetZoomState = () => {
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
    zoomScaleRef.current = 1;
    zoomPointersRef.current.clear();
    zoomLastDistanceRef.current = null;
  };

  const cancelSingleTapZoom = () => {
    if (singleTapTimerRef.current != null) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  };

  const openZoom = () => {
    if (isServerProductLoading || foundProduct?.id == null || galleryImages.length === 0) return;
    resetZoomState();
    setZoomOpen(true);
  };

  const closeZoom = () => {
    cancelSingleTapZoom();
    setZoomOpen(false);
    resetZoomState();
  };

  const scheduleSingleTapZoom = () => {
    if (isServerProductLoading || foundProduct?.id == null || galleryImages.length === 0) return;
    cancelSingleTapZoom();
    singleTapTimerRef.current = window.setTimeout(() => {
      openZoom();
      singleTapTimerRef.current = null;
    }, 340);
  };

  const product = {
    id: foundProduct.id,
    title: foundProduct.title,
    price: foundProduct.price,
    images: galleryImages,
    condition: foundProduct.condition || "Like New",
    category: foundProduct.category || "General",
    description: typeof foundProduct.description === "string" ? foundProduct.description : "",
    location: foundProduct.location,
    postedDate: foundProduct.createdAt ? new Date(foundProduct.createdAt).toLocaleDateString() : "Just now",
    views: typeof foundProduct.views === "number" ? foundProduct.views : Number(foundProduct.views) || 0,
    likes: likeCount,
    seller: {
      id: sellerPeerId || "unknown",
      name: sellerDisplayName,
      avatar: getAvatarUrl(
        sellerProfile?.avatar_url,
        sellerProfile?.gender,
        sellerProfile?.full_name?.trim() || sellerDisplayName || "Member",
      ),
      rating: displaySellerRating,
      reviews: displaySellerReviewCount,
      verified: sellerIdVerified || sellerTierLower === "crown" || sellerTierLower === "blue",
      memberSince: sellerProfile?.created_at
        ? new Date(sellerProfile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "—",
      tier: sellerTierRaw || "standard",
    },
    deliveryOptions: parseDeliveryOptionsFromDb(foundProduct.deliveryOptions ?? foundProduct.delivery_options),
  };

  const loadComments = useCallback(
    async (reset = false, startOverride?: number) => {
      const pid = normalizeRouteProductId(id) ?? (foundProduct?.id != null ? String(foundProduct.id) : null);
      if (!pid) {
        setComments([]);
        setCommentsHasMore(false);
        setCommentsTotal(0);
        setCommentsReady(true);
        setCommentsLoading(false);
        return;
      }
      const start = reset ? 0 : startOverride ?? commentsLengthRef.current;
      if (reset) {
        setComments([]);
        setCommentsHasMore(true);
        setCommentsReady(false);
        setCommentsTotal(0);
      }
      setCommentsLoading(true);

      try {
        const { data, error, count } = await supabase
          .from("product_comments")
          .select("id, user_id, comment, like_count, created_at", { count: "exact" })
          .eq("product_id", pid)
          .order("created_at", { ascending: false })
          .range(start, start + COMMENTS_PAGE_SIZE - 1);

        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (!(msg.includes("product_comments") && msg.includes("does not exist"))) {
            console.error("ProductDetail loadComments failed:", {
              productId: pid,
              start,
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            });
          }
          setCommentsReady(true);
          setCommentsLoading(false);
          setCommentsHasMore(false);
          return;
        }

        const rows =
          (data ?? []) as {
            id: string | null;
            user_id: string | null;
            comment: string | null;
            like_count: number | null;
            created_at: string | null;
          }[];

        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
        const profileMap = new Map<
          string,
          { full_name: string | null; avatar_url: string | null; gender: string | null }
        >();
        if (userIds.length > 0) {
          const { data: profs, error: profileError } = await supabase
            .from("profiles_public")
            .select("id, full_name, avatar_url, gender")
            .in("id", userIds);
          if (profileError) {
            console.error("ProductDetail loadComments profiles failed:", {
              productId: pid,
              message: profileError.message,
              code: profileError.code,
            });
          }
          for (const p of (profs ?? []) as {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
            gender: string | null;
          }[]) {
            if (p.id) profileMap.set(String(p.id), p);
          }
        }

        let likedSet = new Set<string>();
        if (authUserId && rows.length > 0) {
          const commentIds = rows.map((r) => r.id).filter(Boolean) as string[];
          if (commentIds.length > 0) {
            const { data: likedRows, error: likedError } = await supabase
              .from("comment_likes")
              .select("comment_id")
              .eq("user_id", authUserId)
              .in("comment_id", commentIds);
            if (likedError) {
              console.error("ProductDetail loadComments likes failed:", {
                productId: pid,
                message: likedError.message,
                code: likedError.code,
              });
            }
            likedSet = new Set(
              (likedRows ?? []).map((r) => {
                const cid = (r as { comment_id: string }).comment_id;
                return cid ? String(cid) : "";
              }),
            );
          }
        }

        const mapped: ProductCommentDisplay[] = rows.map((r, index) => {
          const commentId = String(r.id ?? `comment-${start + index}`);
          const userId = String(r.user_id ?? "");
          const profile = profileMap.get(userId);
          const name = profile?.full_name?.trim() || "Member";
          return {
            id: commentId,
            user_id: userId,
            comment: String(r.comment ?? ""),
            created_at: String(r.created_at ?? ""),
            like_count: Number(r.like_count ?? 0),
            user_name: name,
            user_avatar: getAvatarUrl(profile?.avatar_url ?? null, profile?.gender ?? null, name),
            liked_by_me: likedSet.has(commentId),
          };
        });

        console.info("ProductDetail loaded comments:", {
          productId: pid,
          fetched: mapped.length,
          total: count ?? mapped.length,
          reset,
          start,
        });

        const nextLength = start + mapped.length;
        setComments((prev) => (reset ? mapped : [...prev, ...mapped]));
        setCommentsTotal(count ?? nextLength);
        setCommentsHasMore(count != null ? nextLength < count : mapped.length === COMMENTS_PAGE_SIZE);
        setCommentsReady(true);
        setCommentsLoading(false);
      } catch (error) {
        console.error("ProductDetail loadComments threw:", {
          productId: pid,
          start,
          error,
        });
        setCommentsReady(true);
        setCommentsLoading(false);
        setCommentsHasMore(false);
      }
    },
    [authUserId, commentsLengthRef, foundProduct?.id, id],
  );

  useEffect(() => {
    void loadComments(true, 0);
  }, [loadComments]);

  const handleSubmitComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!authUserId) {
      toast.message("Sign in to comment");
      navigate("/login");
      return;
    }
    const text = commentInput.trim();
    if (!text) {
      toast.error("Please write a comment first");
      return;
    }
    const pid = normalizeRouteProductId(id) ?? (foundProduct?.id != null ? String(foundProduct.id) : null);
    if (!pid) return;
    setCommentBusy(true);
    const { data, error } = await supabase
      .from("product_comments")
      .insert({
        product_id: pid,
        user_id: authUserId,
        comment: text,
      })
      .select("id, user_id, comment, like_count, created_at")
      .single();
    setCommentBusy(false);
    if (error) {
      toast.error("Could not post comment");
      return;
    }
    const name = (authUser.user_metadata?.full_name as string | undefined)?.trim() || "You";
    const newComment: ProductCommentDisplay = {
      id: (data as { id: string }).id,
      user_id: authUserId,
      comment: text,
      created_at: (data as { created_at: string }).created_at,
      like_count: Number((data as { like_count?: number }).like_count ?? 0),
      user_name: name,
      user_avatar: getAvatarUrl(
        (authUser.user_metadata?.avatar_url as string | null) ?? null,
        (authUser.user_metadata?.gender as string | null) ?? null,
        name,
      ),
      liked_by_me: false,
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentInput("");
    setCommentsTotal((c) => c + 1);
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!authUserId) {
      toast.message("Sign in to like comments");
      navigate("/login");
      return;
    }
    if (commentLikeBusy.has(commentId)) return;
    const existing = comments.find((c) => c.id === commentId);
    if (!existing) return;
    const nextLiked = !existing.liked_by_me;
    const prevCount = existing.like_count;
    setCommentLikeBusy((prev) => {
      const n = new Set(prev);
      n.add(commentId);
      return n;
    });
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, liked_by_me: nextLiked, like_count: nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1) } : c,
      ),
    );
    const { error } = nextLiked
      ? await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: authUserId })
      : await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", authUserId);
    if (error) {
      toast.error("Could not update like");
      setComments((prev) => prev.map((c) => (c.id === commentId ? existing : c)));
    }
    setCommentLikeBusy((prev) => {
      const n = new Set(prev);
      n.delete(commentId);
      return n;
    });
  };

  const handlePrevImage = () => {
    if (product.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (product.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
  };

  const onGalleryTouchStart = (e: TouchEvent) => {
    if (isServerProductLoading || foundProduct?.id == null) return;
    galleryTouchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onGalleryTouchEnd = (e: TouchEvent) => {
    if (isServerProductLoading || foundProduct?.id == null) {
      galleryTouchStartX.current = null;
      cancelSingleTapZoom();
      return;
    }
    const touch = e.changedTouches[0];
    const now = Date.now();
    if (touch) {
      const delta = now - lastTapRef.current;
      if (delta < 320) {
        e.preventDefault();
        cancelSingleTapZoom();
        handleDoubleTapLike(touch.clientX, touch.clientY);
        lastTapRef.current = 0;
        galleryTouchStartX.current = null;
        return;
      }
      lastTapRef.current = now;
    }

    const start = galleryTouchStartX.current;
    galleryTouchStartX.current = null;
    if (start == null || product.images.length <= 1) return;
    const end = touch?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (Math.abs(dx) >= 48) {
      cancelSingleTapZoom();
      if (dx > 0) handlePrevImage();
      else handleNextImage();
      return;
    }
    scheduleSingleTapZoom();
  };

  const onGalleryClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isServerProductLoading || foundProduct?.id == null) {
      cancelSingleTapZoom();
      return;
    }
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta < 320) {
      cancelSingleTapZoom();
      handleDoubleTapLike(e.clientX, e.clientY);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    scheduleSingleTapZoom();
  };

  const onZoomPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoomOpen) return;
    e.preventDefault();
    zoomPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onZoomPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoomOpen) return;
    if (!zoomPointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    const prev = zoomPointersRef.current.get(e.pointerId);
    if (!prev) return;
    zoomPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...zoomPointersRef.current.values()];
    if (points.length >= 2) {
      const [p1, p2] = points;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const last = zoomLastDistanceRef.current ?? dist;
      zoomLastDistanceRef.current = dist;
      setZoomScale((prevScale) => {
        const next = clampScale(prevScale * (dist / last));
        zoomScaleRef.current = next;
        return next;
      });
    } else if (points.length === 1 && zoomScaleRef.current > 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setZoomOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    }
  };

  const onZoomPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    zoomPointersRef.current.delete(e.pointerId);
    if (zoomPointersRef.current.size < 2) {
      zoomLastDistanceRef.current = null;
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onZoomWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!zoomOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoomScale((prev) => {
      const next = clampScale(prev + delta);
      zoomScaleRef.current = next;
      return next;
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = product.title;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        });
      } catch (err) {
        console.error("Error sharing", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const priceNum = Number(product.price);
  const priceDisplay = formatPrice(Number.isFinite(priceNum) ? priceNum : null);

  const sellerPhoneRaw = sellerProfile?.phone != null ? String(sellerProfile.phone).trim() : "";
  const sellerTelHref = sellerPhoneRaw ? `tel:${sellerPhoneRaw.replace(/\s/g, "")}` : "";
  const whatsappDigits = sellerPhoneRaw.replace(/\D/g, "");
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";

  const dbProductAvg = foundProduct?.average_rating != null ? Number(foundProduct.average_rating) : NaN;
  const dbProductTotal = Number(foundProduct?.total_reviews ?? 0);
  const productRatingAvg =
    Number.isFinite(dbProductAvg) && dbProductTotal > 0
      ? Math.round(dbProductAvg * 10) / 10
      : productReviews.length > 0
        ? Math.round((productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length) * 10) / 10
        : 0;
  const productRatingTotal = dbProductTotal > 0 ? dbProductTotal : productReviews.length;
  const userHasProductReview = Boolean(authUserId && productReviews.some((r) => r.user_id === authUserId));
  const productIdForReviewLink = normalizeRouteProductId(id) ?? String(foundProduct?.id ?? "");
  const safeProductReviews = productReviews.filter(
    (review): review is ProductReviewDisplay =>
      Boolean(review) && typeof review === "object" && "id" in review && review.id != null,
  );
  const safeSellerReviewsPreview = sellerReviewsPreview.filter(
    (review): review is SellerReviewPreview =>
      Boolean(review) && typeof review === "object" && "id" in review && review.id != null,
  );
  const safeComments = comments.filter(
    (comment): comment is ProductCommentDisplay =>
      Boolean(comment) && typeof comment === "object" && "id" in comment && comment.id != null,
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-28 md:pb-8">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-3 sm:px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-700"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void handleShare()}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-600"
              aria-label="Share"
            >
              <Share2 className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              disabled={likeBusy}
              onClick={() => void handleToggleLike()}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
              aria-label={liked ? "Unlike" : "Like"}
            >
              <Heart
                className={`w-[18px] h-[18px] ${liked ? "fill-red-500 text-red-500" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-4 md:px-4 md:pt-6 lg:pt-8">
        {/* Image column first = left on desktop (matches marketplace listing layout) */}
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-start md:gap-5 lg:gap-8 xl:gap-12 2xl:gap-14">
          <div className="flex shrink-0 justify-center md:col-span-5 md:justify-start md:sticky md:top-14 lg:col-span-5">
            <div className="relative w-full max-w-[520px] md:max-w-none mx-auto">
              <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200/90">
                <div
                  ref={galleryRef}
                  className="relative aspect-[3/4] w-full bg-gray-100 md:min-h-[min(70vh,560px)] md:aspect-auto md:h-[min(70vh,560px)] touch-manipulation"
                  role="region"
                  aria-label="Product gallery"
                  aria-roledescription="carousel"
                  onTouchStart={onGalleryTouchStart}
                  onTouchEnd={onGalleryTouchEnd}
                  onClick={onGalleryClick}
                >
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[currentImageIndex]}
                      alt={product.title}
                      className="absolute inset-0 w-full h-full object-cover select-none"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-400 text-sm px-6 text-center"
                      aria-hidden
                    >
                      No image
                    </div>
                  )}
                  {tapHearts.map((heart) => (
                    <span
                      key={heart.id}
                      className="pointer-events-none absolute text-red-500 drop-shadow-sm animate-[ping_0.8s_cubic-bezier(0,0,0.2,1)_1]"
                      style={{ left: heart.x, top: heart.y, transform: "translate(-50%, -50%)" }}
                      aria-hidden
                    >
                      <Heart className="w-12 h-12" />
                    </span>
                  ))}
                {product.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-sm ring-1 ring-gray-200/80 flex items-center justify-center text-gray-800"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-sm ring-1 ring-gray-200/80 flex items-center justify-center text-gray-800"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
                  <span className="absolute top-3 left-3 z-[1] bg-[#15803d] text-white text-[11px] font-semibold px-2 py-1 rounded-lg shadow-sm">
                    {product.condition}
                  </span>
                  <BoostDetailBadge row={foundProduct as Record<string, unknown>} />
                  {product.images.length > 1 ? (
                    <span className="absolute bottom-3 right-3 z-[2] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white shadow-sm">
                      {currentImageIndex + 1}/{product.images.length}
                    </span>
                  ) : null}
                </div>
              </div>
              {product.images.length > 1 && (
                <div className="mt-3 w-full -mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] touch-pan-x">
                  <div className="flex w-max gap-2 px-1 snap-x snap-mandatory">
                    {product.images.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setCurrentImageIndex(index)}
                        className={`relative shrink-0 snap-start rounded-lg overflow-hidden ring-2 transition-all w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] ${
                          index === currentImageIndex
                            ? "ring-[#16a34a] shadow-md scale-[1.02]"
                            : "ring-transparent opacity-85 hover:opacity-100 hover:ring-gray-200"
                        }`}
                        aria-label={`Show image ${index + 1} of ${product.images.length}`}
                        aria-current={index === currentImageIndex ? "true" : undefined}
                      >
                        {src ? (
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gray-200" aria-hidden />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 md:col-span-7 md:pt-0 lg:col-span-7">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 leading-snug tracking-tight">
                {product.title}
              </h1>
              <p className="text-2xl md:text-3xl font-bold text-[#15803d] mt-3 tabular-nums">{priceDisplay}</p>
              {!productReviewsReady ? (
                <p className="mt-3 text-sm text-gray-400">Loading reviews…</p>
              ) : productRatingTotal > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-0.5" aria-label={`${productRatingAvg} out of 5 average`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.round(productRatingAvg) ? "fill-amber-400 text-amber-400" : "text-gray-200"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{productRatingAvg.toFixed(1)}</span>
                  <span className="text-sm text-gray-500">
                    ({productRatingTotal} {productRatingTotal === 1 ? "review" : "reviews"})
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No product reviews yet.</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                {product.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                    {product.location}
                  </span>
                ) : null}
                {product.location ? <span className="text-gray-300">·</span> : null}
                <span>{product.postedDate}</span>
                <span className="text-gray-300">·</span>
                <span>{product.views} views</span>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Heart className={`w-3.5 h-3.5 ${liked ? "fill-red-500 text-red-500" : ""}`} aria-hidden />
                  {product.likes} likes
                </span>
              </div>
            </div>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <div className="flex items-start gap-3">
                <img
                  src={product.seller.avatar}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover bg-gray-100 shrink-0 ring-1 ring-gray-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="relative font-semibold text-gray-900 inline-flex items-center gap-1.5">
                      {sellerOnline ? (
                        <span className="relative flex h-2 w-2 shrink-0" title="Online now">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </span>
                      ) : null}
                      {product.seller.name}
                    </span>
                    {product.seller.verified ? (
                      <BadgeCheck className="w-4 h-4 text-[#16a34a] fill-emerald-100 shrink-0" title="Verified seller" />
                    ) : sellerTierLower === "crown" ? (
                      <BadgeCheck className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" title="Crown verified" />
                    ) : sellerTierLower === "blue" ? (
                      <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-400 shrink-0" title="Blue verified" />
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <Star className="w-3.5 h-3.5 inline text-amber-400 fill-amber-400 align-[-2px] mr-0.5" aria-hidden />
                    {product.seller.reviews > 0 ? (
                      <>
                        {product.seller.rating}
                        <span className="text-gray-500">
                          {" "}
                          ({product.seller.reviews} {product.seller.reviews === 1 ? "review" : "reviews"})
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">No reviews yet</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1.5">Member since {product.seller.memberSince}</p>
                  {!sellerOnline && sellerProfile?.last_active ? (
                    <p className="text-[11px] text-gray-400 mt-1">{formatLastSeen(sellerProfile.last_active)}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex gap-2 items-stretch">
                  {canMessageSeller ? (
                    <Link
                      to={`/messages/u/${sellerPeerId}?product=${product.id}`}
                      className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] text-white text-sm font-semibold px-4 hover:bg-[#15803d] shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
                      Chat
                    </Link>
                  ) : (
                    <p className="flex-1 min-h-[46px] flex items-center justify-center rounded-xl bg-gray-50 px-3 text-center text-xs text-gray-500 ring-1 ring-gray-100">
                      Seller account unavailable for chat.
                    </p>
                  )}
                  <div className="relative shrink-0" ref={phoneMenuRef}>
                    <button
                      type="button"
                      disabled={!sellerTelHref}
                      onClick={() => {
                        if (sellerTelHref) setPhoneMenuOpen((o) => !o);
                      }}
                      className={`min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-xl ring-1 shrink-0 ${
                        sellerTelHref
                          ? "ring-gray-200 text-gray-800 hover:bg-gray-50"
                          : "ring-gray-100 text-gray-300 cursor-not-allowed"
                      }`}
                      title={sellerTelHref ? "Call or WhatsApp" : "No phone number available"}
                      aria-label={sellerTelHref ? "Phone options" : "No phone number available"}
                      aria-expanded={phoneMenuOpen}
                      aria-haspopup="menu"
                    >
                      <Phone className="w-4 h-4" aria-hidden />
                    </button>
                    {phoneMenuOpen && sellerTelHref ? (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                        role="menu"
                      >
                        <a
                          href={sellerTelHref}
                          role="menuitem"
                          className="block px-3 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
                          onClick={() => setPhoneMenuOpen(false)}
                        >
                          Call
                        </a>
                        {whatsappHref ? (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            role="menuitem"
                            className="block px-3 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
                            onClick={() => setPhoneMenuOpen(false)}
                          >
                            WhatsApp
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {canMessageSeller ? (
                  <Link
                    to={`/profile/${sellerPeerId}`}
                    className="w-full min-h-[46px] inline-flex items-center justify-center rounded-xl ring-1 ring-gray-200 text-sm font-semibold text-gray-800 px-4 hover:bg-gray-50"
                  >
                    View profile
                  </Link>
                ) : (
                  <span className="w-full min-h-[46px] inline-flex items-center justify-center rounded-xl ring-1 ring-gray-100 text-sm font-medium text-gray-400 px-4 cursor-not-allowed">
                    View profile
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product reviews</h2>
                {authUserId &&
                String(foundProduct.seller_id ?? foundProduct.sellerId ?? "").trim() !== authUserId ? (
                  <Link
                    to={`/products/${encodeURIComponent(productIdForReviewLink)}/write-review`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#22c55e] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#15803d]"
                  >
                    {userHasProductReview ? "Edit your review" : "Write a review"}
                  </Link>
                ) : null}
              </div>
              {!productReviewsReady ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : safeProductReviews.length === 0 ? (
                <p className="text-sm text-gray-500">No written reviews yet. Be the first to review this item.</p>
              ) : (
                <ul className="space-y-4">
                  {safeProductReviews.map((r) => (
                    <li key={r.id} className="rounded-xl bg-gray-50/90 p-3 ring-1 ring-gray-100">
                      <div className="flex items-start gap-3">
                        <img
                          src={r.reviewer_avatar}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-gray-100"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900">{r.reviewer_name}</span>
                            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                                />
                              ))}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                          {r.comment.trim() ? (
                            <p className="mt-2 text-sm leading-relaxed text-gray-700">{r.comment.trim()}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Buyer reviews</h2>
                {sellerPeerId && sellerReviewCount > 0 ? (
                  <Link
                    to={`/profile/${sellerPeerId}?tab=reviews`}
                    className="text-xs font-semibold text-[#15803d] hover:underline shrink-0"
                  >
                    See all
                  </Link>
                ) : null}
              </div>
              {safeSellerReviewsPreview.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews for this seller yet.</p>
              ) : (
                <ul className="space-y-3">
                  {safeSellerReviewsPreview.map((r) => (
                    <li key={r.id} className="rounded-xl bg-gray-50/90 ring-1 ring-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{r.reviewer_name}</span>
                        <span className="flex items-center gap-0.5 shrink-0" aria-hidden>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </p>
                      {r.comment?.trim() ? (
                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.comment.trim()}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Description</h2>
              {product.description ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
              ) : (
                <p className="text-sm text-gray-500">No description provided.</p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Delivery options</h2>
              {product.deliveryOptions.length === 0 ? (
                <p className="text-sm text-gray-500">No delivery options listed for this item.</p>
              ) : (
                <ul className="space-y-0 divide-y divide-gray-100">
                  {product.deliveryOptions.map((option, index) => (
                    <li key={index} className="flex items-center justify-between gap-4 text-sm py-3 first:pt-0">
                      <div>
                        <p className="font-medium text-gray-900">{option.name}</p>
                        {option.duration ? (
                          <p className="text-gray-500 text-xs mt-0.5">{option.duration}</p>
                        ) : null}
                      </div>
                      <p className="font-semibold text-gray-900 tabular-nums shrink-0">
                        {option.fee === 0 ? "Free" : formatPrice(option.fee)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Comments</h2>
                <span className="text-xs text-gray-500 tabular-nums">{commentsTotal} total</span>
              </div>
              <form onSubmit={(e) => void handleSubmitComment(e)} className="mb-4 space-y-2">
                <Textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Share your thoughts about this product"
                  className="min-h-[88px]"
                />
                <div className="flex items-center gap-2">
                  {!authUser ? (
                    <span className="text-xs text-gray-500">Sign in to add a comment.</span>
                  ) : null}
                  <button
                    type="submit"
                    disabled={commentBusy || !commentInput.trim()}
                    className="ml-auto inline-flex items-center justify-center rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {commentBusy ? "Posting…" : "Post comment"}
                  </button>
                </div>
              </form>
              {!commentsReady ? (
                <p className="text-sm text-gray-500">Loading comments…</p>
              ) : safeComments.length === 0 ? (
                <p className="text-sm text-gray-500">No comments yet. Be the first to share.</p>
              ) : (
                <ul className="space-y-3">
                  {safeComments.map((c) => (
                    <li key={c.id} className="rounded-xl bg-gray-50/90 p-3 ring-1 ring-gray-100">
                      <div className="flex items-start gap-3">
                        <img
                          src={c.user_avatar}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-gray-100"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.user_name}</p>
                              <p className="text-[11px] text-gray-400">
                                {new Date(c.created_at).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={commentLikeBusy.has(c.id)}
                              onClick={() => void handleToggleCommentLike(c.id)}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 transition-colors ${
                                c.liked_by_me
                                  ? "bg-red-50 text-red-600 ring-red-100"
                                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                              aria-label={c.liked_by_me ? "Unlike comment" : "Like comment"}
                            >
                              <Heart className={`w-4 h-4 ${c.liked_by_me ? "fill-current" : ""}`} />
                              <span className="tabular-nums">{c.like_count}</span>
                            </button>
                          </div>
                          {c.comment.trim() ? (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-800">{c.comment.trim()}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {commentsHasMore ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void loadComments(false, commentsLengthRef.current)}
                    disabled={commentsLoading}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {commentsLoading ? "Loading…" : "Load more comments"}
                  </button>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl bg-amber-50/90 px-4 py-4 text-sm text-gray-800 ring-1 ring-amber-100/80">
              <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-700 shrink-0" aria-hidden />
                Safety tips
              </p>
              <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Meet in a safe public place when collecting items.</li>
                <li>Inspect the product before you pay.</li>
                <li>Don&apos;t share sensitive financial info or OTPs.</li>
              </ul>
            </section>
          </div>
        </div>

        <div className="mt-12 md:mt-16 space-y-12 border-t border-gray-200 pt-10 pb-4">
          {moreFromSeller.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">More from this seller</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">Other listings by {product.seller.name}</p>
              <RelatedProductsCarousel items={moreFromSeller} formatPrice={formatPrice} />
            </div>
          ) : null}

          {relatedProducts.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Similar from other sellers</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">Same category · swipe or use arrows</p>
              <RelatedProductsCarousel items={relatedProducts} formatPrice={formatPrice} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl gap-2 px-3 py-3 sm:px-4">
          {canMessageSeller ? (
            <Link
              to={`/messages/u/${sellerPeerId}?product=${product.id}`}
              className="hidden sm:inline-flex px-4 py-3 rounded-xl ring-1 ring-gray-200 text-sm font-semibold text-gray-800 items-center justify-center hover:bg-gray-50"
            >
              Chat
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              addToCart({
                id: product.id.toString(),
                title: product.title,
                price: product.price,
                image: product.images[0] ?? "",
                quantity: 1,
                sellerId: sellerPeerId || product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0]?.fee ?? 0,
              });
              toast.success("Added to cart");
            }}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:hidden" />
              Add to cart
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              addToCart({
                id: product.id.toString(),
                title: product.title,
                price: product.price,
                image: product.images[0] ?? "",
                quantity: 1,
                sellerId: sellerPeerId || product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0]?.fee ?? 0,
              });
              navigate("/checkout");
            }}
            className="flex-1 py-3 rounded-xl bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d]"
          >
            Buy now
          </button>
        </div>
      </div>

      {zoomOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeZoom}
          role="dialog"
          aria-label="Zoomed product image"
        >
          <div className="relative h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div
              className="h-full w-full overflow-hidden rounded-2xl bg-black touch-none"
              onPointerDown={onZoomPointerDown}
              onPointerMove={onZoomPointerMove}
              onPointerUp={onZoomPointerUp}
              onPointerCancel={onZoomPointerUp}
              onWheel={onZoomWheel}
            >
              {product.images.length > 0 ? (
                <img
                  src={product.images[currentImageIndex]}
                  alt={product.title}
                  className="h-full w-full object-contain select-none"
                  style={{ transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})` }}
                  draggable={false}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-300">No image</div>
              )}
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="text-[11px] text-white/80 bg-black/50 rounded-full px-3 py-1">Pinch to zoom, tap to close</span>
              <button
                type="button"
                onClick={closeZoom}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductDetail() {
  return (
    <ProductDetailErrorBoundary>
      <ProductDetailContent />
    </ProductDetailErrorBoundary>
  );
}
