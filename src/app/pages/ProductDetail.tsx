import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type TouchEvent as ReactTouchEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Heart,
  Share2,
  Users,
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
import { isOnlineFromLastActive, formatLastSeen } from "../utils/presence";
import { getAvatarUrl } from "../utils/getAvatar";
import { getProductPrice } from "../utils/getProductPrice";
import { activeProductsQuery, mapProductRow } from "../utils/productSearch";
import { getProductThumbnailUrl, optimizeListingImageUrl, parseProductImagesFromRow } from "../utils/productImages";
import { recordProductView } from "../utils/recentlyViewedProducts";
import { toast } from "sonner";
import { BoostDetailBadge } from "../components/BoostBadge";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { VerifiedAdvertiserBadge } from "../components/VerifiedAdvertiserBadge";
import { getAuthSiteOrigin } from "../utils/authSiteUrl";
import { useProductLike } from "../hooks/useProductLike";
import { normalizeProductPk } from "../utils/engagement";
import {
  fetchProductReviewsForProduct,
  formatProductReviewDate,
  isMissingProductReviewsTableError,
  isRecoverableReviewQueryError,
  normalizeReviewProductId,
  type ProductReviewDisplay,
} from "../utils/reviews";
import { formatGreenHubMonthYear, formatGreenHubRelative } from "../utils/formatGreenHubTime";
import { cn } from "../components/ui/utils";
import { buildInternationalDeliveryOptions } from "../data/internationalShippingPresets";
import { EditProductModal } from "../components/EditProductModal";
import { PriceNegotiation } from "../components/PriceNegotiation";
import { MarketPricePrediction } from "../components/MarketPricePrediction";
import { SimilarProductsLinks } from "../components/SimilarProductsLinks";
// Old import
// import ProductDetailInlineChat from "../components/ProductDetailInlineChat";
// New import
import ProductDetailInlineChat from "../components/NewProductDetailInlineChat";

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

/** Compact display for follower counts on product detail (e.g. 1.2K when over 1000). */
function formatFollowerShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n <= 1000) return n.toLocaleString();
  const k = n / 1000;
  const rounded = Math.round(k * 10) / 10;
  const s = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${s}K`;
}

const DEFAULT_DOCUMENT_TITLE = "GreenHub - Buy & Sell in Nigeria";
const DEFAULT_META_DESCRIPTION =
  "GreenHub is Nigeria's premier C2C marketplace to buy and sell electronics, fashion, and goods securely.";

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
  is_verified_advertiser?: boolean | null;
  is_verified?: boolean | null;
  verified_badge?: string | null;
};

type SellerReviewPreview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
};

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

  if (items.length === 0) return null;

  return (
    <div
      className="relative -mx-1 sm:mx-0"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="overflow-hidden sm:rounded-xl" ref={emblaRef}>
        <div className="flex -ml-3 sm:-ml-4 touch-pan-x">
          {items.map((item) => (
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
                      src={optimizeListingImageUrl(item.image, { width: 400, quality: 70 })}
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

      {items.length > 1 ? (
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

export default function ProductDetail() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user: authUser } = useAuth();
  /** Main gallery URL: first of `images[]` or legacy `image`; synced when listing loads/changes. */
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  /** Mobile-only: reduces scroll by showing one section at a time. Desktop shows full stack. */
  const [mobileDetailTab, setMobileDetailTab] = useState<"details" | "seller" | "reviews" | "about">("details");
  const galleryTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Second tap within window → double-tap to like (mobile). */
  const galleryDoubleTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const [heartPopSeq, setHeartPopSeq] = useState(0);
  const [sellerProfile, setSellerProfile] = useState<SellerProfileRow | null>(null);
  const [sellerReviewAvg, setSellerReviewAvg] = useState(0);
  const [sellerReviewCount, setSellerReviewCount] = useState(0);
  const [sellerReviewsPreview, setSellerReviewsPreview] = useState<SellerReviewPreview[]>([]);
  const [sellerIdVerified, setSellerIdVerified] = useState(false);
  const [sellerVerifiedAdvertiser, setSellerVerifiedAdvertiser] = useState(false);
  const [sellerInfoReady, setSellerInfoReady] = useState(false);
  const [serverProduct, setServerProduct] = useState<any>(null);
  const [isServerProductLoading, setIsServerProductLoading] = useState<boolean>(true);
  const [relatedProducts, setRelatedProducts] = useState<RelatedCarouselItem[]>([]);
  const [moreFromSeller, setMoreFromSeller] = useState<RelatedCarouselItem[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReviewDisplay[]>([]);
  const [productReviewsReady, setProductReviewsReady] = useState(false);
  const [sellerFollowerCount, setSellerFollowerCount] = useState<number | null>(null);
  const [sellerFollowerCountLoading, setSellerFollowerCountLoading] = useState(false);
  const [sellerFollowerCountFailed, setSellerFollowerCountFailed] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const raw = serverProduct?.seller_id ?? serverProduct?.sellerId;
    const sellerUuid = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    if (!sellerUuid) {
      setSellerFollowerCount(null);
      setSellerFollowerCountLoading(false);
      setSellerFollowerCountFailed(false);
      return;
    }
    let cancelled = false;
    setSellerFollowerCount(null);
    setSellerFollowerCountFailed(false);
    setSellerFollowerCountLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("profile_follower_count", { p_user_id: sellerUuid });
      if (cancelled) return;
      setSellerFollowerCountLoading(false);
      if (error) {
        setSellerFollowerCountFailed(true);
        setSellerFollowerCount(null);
        return;
      }
      const n = typeof data === "bigint" ? Number(data) : Number(data);
      setSellerFollowerCountFailed(false);
      setSellerFollowerCount(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.seller_id, serverProduct?.sellerId]);

  /** URL `products/:id` — pass through trimmed string so PostgREST matches int/bigint/uuid PKs without Number() precision loss */
  const normalizeRouteProductId = (raw: string | undefined): string | null => {
    if (raw == null) return null;
    const t = raw.trim();
    return t || null;
  };

  const refetchProduct = useCallback(async () => {
    const idForQuery = normalizeRouteProductId(id);
    if (idForQuery == null) return;
    const { data, error } = await supabase.from("products").select("*").eq("id", idForQuery).maybeSingle();
    if (error || !data) return;
    const v = data.views;
    const viewsNum = typeof v === "number" ? v : v != null ? Number(v) : 0;
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
  }, [id]);

  const foundProduct = serverProduct;
  const likeProductId = useMemo(() => normalizeProductPk(foundProduct?.id), [foundProduct?.id]);
  const initialLikeCount = useMemo(() => {
    const n = Number(foundProduct?.like_count ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [foundProduct?.like_count]);
  const {
    liked,
    likeBusy,
    likeCount,
    toggleLike: toggleProductLikeState,
  } = useProductLike({
    productId: likeProductId,
    initialLikeCount,
    userId: authUser?.id ?? null,
    onAuthRequired: () => {
      toast.message("Login to like");
      navigate("/login");
    },
    onError: (message) => toast.error(message),
  });

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
    setSelectedImage((prev) => {
      if (imgs.length === 0) return "";
      if (prev && imgs.includes(prev)) return prev;
      return imgs[0] ?? "";
    });
  }, [foundProduct?.id, foundProduct?.image, foundProduct?.images]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

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

  const loadProductReviews = useCallback(async () => {
    const pid = normalizeReviewProductId(serverProduct?.id);
    if (pid == null) {
      setProductReviews([]);
      setProductReviewsReady(true);
      return;
    }

    setProductReviewsReady(false);
    const { data, error } = await fetchProductReviewsForProduct(supabase, pid);
    if (error) {
      if (!isMissingProductReviewsTableError(error.message) && !isRecoverableReviewQueryError(error.message)) {
        console.warn("ProductDetail product_reviews:", error.message);
      }
      setProductReviews([]);
      setProductReviewsReady(true);
      return;
    }

    setProductReviews(data);
    setProductReviewsReady(true);
  }, [serverProduct?.id]);

  useEffect(() => {
    void loadProductReviews();
  }, [loadProductReviews]);

  useEffect(() => {
    const pid = normalizeReviewProductId(serverProduct?.id);
    if (pid == null) return;

    const channel = supabase
      .channel(`product-reviews:${String(pid)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_reviews",
          filter: `product_id=eq.${String(pid)}`,
        },
        () => {
          void loadProductReviews();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadProductReviews, serverProduct?.id]);

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
        console.warn("ProductDetail:", error.message);
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
      } else {
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
      setSellerVerifiedAdvertiser(false);
      setSellerInfoReady(true);
      return;
    }
    const idStr = String(rawSid).trim();

    const loadSellerContext = async () => {
      setSellerInfoReady(false);

      const [profRes, ratingsRes, previewRes, verRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, gender, state, lga, created_at, phone, last_active, is_verified_advertiser, is_verified, verified_badge")
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
          .select("id, full_name, avatar_url, gender, state, lga, created_at, last_active, phone, is_verified_advertiser, is_verified, verified_badge")
          .eq("id", idStr)
          .maybeSingle();
        if (cancelled) return;
        if (pub.data) prof = pub.data as SellerProfileRow;
      }

      if (cancelled) return;
      setSellerProfile(prof);
      setSellerVerifiedAdvertiser(Boolean(prof && (prof as SellerProfileRow).is_verified_advertiser));

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

      const approvedVerification = Boolean(verRes.data) && !verRes.error;
      const profileVerified = Boolean(prof?.is_verified);
      setSellerIdVerified(approvedVerification || profileVerified);
      setSellerInfoReady(true);
    };

    void loadSellerContext();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.seller_id, serverProduct?.sellerId]);

  if (isServerProductLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!foundProduct) {
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
  const isOwner = Boolean(authUser?.id && sellerPeerId && authUser.id === sellerPeerId);
  const canMessageSeller = Boolean(sellerPeerId);

  const galleryImages = parseProductImagesFromRow(foundProduct as { image?: unknown; images?: unknown });

  const handleImageDoubleLike = async () => {
    if (!galleryImages.length) return;
    if (likeBusy) return;
    setHeartPopSeq((n) => n + 1);
    const wasLiked = liked;
    const ok = await toggleProductLikeState();
    if (ok) {
      toast.message(wasLiked ? "Unliked" : "Liked!");
    }
  };

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

  const sellerOnline = isOnlineFromLastActive(sellerProfile?.last_active);

  const handleToggleLike = async () => {
    await toggleProductLikeState();
  };

  const sellerId = sellerPeerId;

  const product = {
    id: foundProduct.id,
    title: foundProduct.title,
    price: foundProduct.price,
    images: galleryImages,
    condition: foundProduct.condition || "Like New",
    category: foundProduct.category || "General",
    description: typeof foundProduct.description === "string" ? foundProduct.description : "",
    location: foundProduct.location,
    postedDate: foundProduct.createdAt ? formatGreenHubRelative(foundProduct.createdAt) : "Just now",
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
        ? formatGreenHubMonthYear(sellerProfile.created_at)
        : "—",
      tier: sellerTierRaw || "standard",
    },
    deliveryOptions: parseDeliveryOptionsFromDb(foundProduct.deliveryOptions ?? foundProduct.delivery_options),
    intlDeliveryOptions: buildInternationalDeliveryOptions(
      (foundProduct as { shipping_destinations?: unknown }).shipping_destinations,
      (foundProduct as { international_shipping_fees?: unknown }).international_shipping_fees,
    ),
  };

  const galleryActiveIndex =
    product.images.length === 0
      ? -1
      : (() => {
          const i = product.images.findIndex((u) => u === selectedImage);
          return i >= 0 ? i : 0;
        })();
  const mainDisplayImage =
    galleryActiveIndex >= 0 && product.images[galleryActiveIndex]
      ? product.images[galleryActiveIndex]!
      : "";

  const handlePrevImage = () => {
    if (product.images.length <= 1) return;
    const cur = galleryActiveIndex >= 0 ? galleryActiveIndex : 0;
    const next = cur === 0 ? product.images.length - 1 : cur - 1;
    setSelectedImage(product.images[next] ?? "");
  };

  const handleNextImage = () => {
    if (product.images.length <= 1) return;
    const cur = galleryActiveIndex >= 0 ? galleryActiveIndex : 0;
    const next = cur === product.images.length - 1 ? 0 : cur + 1;
    setSelectedImage(product.images[next] ?? "");
  };

  const onGalleryTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    galleryTouchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onGalleryTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = galleryTouchStartRef.current;
    galleryTouchStartRef.current = null;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (product.images.length > 1 && Math.abs(dx) >= 48) {
      galleryDoubleTapRef.current = null;
      if (dx > 0) handlePrevImage();
      else handleNextImage();
      return;
    }

    if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
      galleryDoubleTapRef.current = null;
      return;
    }

    const now = Date.now();
    const prev = galleryDoubleTapRef.current;
    if (
      prev &&
      now - prev.t < 340 &&
      Math.abs(touch.clientX - prev.x) < 50 &&
      Math.abs(touch.clientY - prev.y) < 50
    ) {
      galleryDoubleTapRef.current = null;
      void handleImageDoubleLike();
      return;
    }
    galleryDoubleTapRef.current = { t: now, x: touch.clientX, y: touch.clientY };
  };

  const onMainImageDoubleClick = (ev: ReactMouseEvent<HTMLImageElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    void handleImageDoubleLike();
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
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hi, I'm interested in ${product.title}`)}`
    : "";
  /** When the seller has no phone on profile, fall back to GreenHub support (same as footer). */
  const supportTelHref = "tel:+2348125221542";
  const callHref = sellerTelHref || supportTelHref;

  const dbProductAvg = foundProduct?.average_rating != null ? Number(foundProduct.average_rating) : NaN;
  const dbProductTotal = Number(foundProduct?.total_reviews ?? 0);
  const hasLoadedProductReviews = productReviews.length > 0;
  const productRatingAvg =
    hasLoadedProductReviews
      ? Math.round((productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length) * 10) / 10
      : Number.isFinite(dbProductAvg) && dbProductTotal > 0
        ? Math.round(dbProductAvg * 10) / 10
        : 0;
  const productRatingTotal = hasLoadedProductReviews ? productReviews.length : dbProductTotal;
  const userHasProductReview = Boolean(authUser && productReviews.some((r) => r.user_id === authUser.id));
  const productIdForReviewLink = normalizeRouteProductId(id) ?? String(foundProduct?.id ?? "");

  const scrollToInlineChat = () => {
    setMobileDetailTab("seller");
    queueMicrotask(() => {
      document.getElementById("product-inline-chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
          <div className="w-10 shrink-0" aria-hidden />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-4 md:px-4 md:pt-6 lg:pt-8">
        {/* Image column first = left on desktop (matches marketplace listing layout) */}
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-start md:gap-5 lg:gap-8 xl:gap-12 2xl:gap-14">
          <div className="flex shrink-0 justify-center md:col-span-5 md:justify-start md:sticky md:top-14 lg:col-span-5">
            <div className="relative w-full max-w-[520px] md:max-w-none mx-auto">
              <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200/90">
                <div
                  className="relative touch-manipulation"
                  role="region"
                  aria-label="Product gallery"
                  aria-roledescription="carousel"
                  onTouchStart={onGalleryTouchStart}
                  onTouchEnd={onGalleryTouchEnd}
                >
                  <div
                    className="relative w-full aspect-[4/3] cursor-zoom-in overflow-hidden rounded-xl bg-gray-100"
                    onClick={() => {
                      if (product.images.length > 0) setLightboxOpen(true);
                    }}
                    role="presentation"
                  >
                    {product.images.length > 0 && mainDisplayImage ? (
                      <img
                        src={optimizeListingImageUrl(mainDisplayImage, { width: 960, quality: 75 })}
                        alt={product.title}
                        className="h-full w-full cursor-zoom-in select-none object-cover"
                        draggable={false}
                        onDoubleClick={onMainImageDoubleClick}
                      />
                    ) : (
                      <div
                        className="flex min-h-[240px] w-full items-center justify-center px-6 py-16 text-center text-sm text-gray-400"
                        aria-hidden
                      >
                        No image
                      </div>
                    )}
                    {heartPopSeq > 0 ? (
                      <div
                        key={heartPopSeq}
                        className="gh-heart-pop pointer-events-none absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2"
                        aria-hidden
                      >
                        <Heart className="h-[4.25rem] w-[4.25rem] fill-red-500 text-red-500 drop-shadow-lg" strokeWidth={1.5} />
                      </div>
                    ) : null}
                    <span className="absolute left-3 top-3 z-[1] rounded-lg bg-[#15803d] px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                      {product.condition}
                    </span>
                  </div>
                  {product.images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrevImage();
                        }}
                        className="absolute left-2 top-1/2 z-[5] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm ring-1 ring-gray-200/80"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextImage();
                        }}
                        className="absolute right-2 top-1/2 z-[5] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm ring-1 ring-gray-200/80"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                  <div className="absolute right-3 top-3 z-[4] flex max-w-[calc(100%-0.75rem)] flex-col items-end gap-2">
                    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Listing actions">
                      <button
                        type="button"
                        disabled={!sellerPeerId}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!sellerPeerId) return;
                          navigate(`/profile/${sellerPeerId}/followers`);
                        }}
                        className="inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-black/50 px-2 py-1.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="View seller followers"
                      >
                        <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="text-[10px] font-semibold leading-none tabular-nums">
                          {!sellerPeerId || sellerFollowerCountFailed
                            ? "--"
                            : sellerFollowerCountLoading || sellerFollowerCount === null
                              ? "..."
                              : formatFollowerShort(sellerFollowerCount)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleShare();
                        }}
                        className="rounded-full bg-black/50 p-1.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/60"
                        aria-label="Share listing"
                      >
                        <Share2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={likeBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleLike();
                        }}
                        className="inline-flex items-center gap-0.5 rounded-full bg-black/50 px-2 py-1.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50"
                        aria-label={liked ? "Unlike" : "Like"}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 shrink-0 ${liked ? "fill-white text-white" : "text-white"}`}
                          fill={liked ? "currentColor" : "none"}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="text-[10px] font-semibold leading-none tabular-nums">{likeCount}</span>
                      </button>
                    </div>
                    <BoostDetailBadge row={foundProduct as Record<string, unknown>} />
                  </div>
                  {product.images.length > 1 ? (
                    <span className="absolute bottom-3 right-3 z-[2] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white shadow-sm">
                      {(galleryActiveIndex >= 0 ? galleryActiveIndex : 0) + 1}/{product.images.length}
                    </span>
                  ) : null}
                </div>
              </div>
              {product.images.length > 1 ? (
                <div className="mt-4 flex w-full gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
                  {product.images.map((src, index) => (
                    <button
                      key={`${src}-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(src)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                        index === galleryActiveIndex ? "border-emerald-500" : "border-transparent"
                      }`}
                      aria-label={`Show image ${index + 1} of ${product.images.length}`}
                      aria-current={index === galleryActiveIndex ? "true" : undefined}
                    >
                      {src ? (
                        <img
                          src={optimizeListingImageUrl(src, { width: 160, quality: 70 })}
                          alt={`Thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-200" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
              {lightboxOpen && product.images.length > 0 && mainDisplayImage ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Zoomed product image"
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
                  onClick={() => setLightboxOpen(false)}
                >
                  <button
                    type="button"
                    className="absolute right-4 top-4 z-[101] rounded-full p-2 text-2xl leading-none text-white hover:bg-white/10"
                    aria-label="Close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(false);
                    }}
                  >
                    ✕
                  </button>
                  <img
                    src={optimizeListingImageUrl(mainDisplayImage, { width: 1600, quality: 82 })}
                    alt=""
                    className="max-h-[90vh] max-w-[90vw] object-cover"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 pt-6 md:col-span-7 md:pt-0 lg:col-span-7">
            <div className="md:hidden -mx-1 mb-2 flex items-center gap-1.5 px-1">
              <div
                className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
                role="tablist"
                aria-label="Listing sections"
              >
                {(
                  [
                    ["details", "Details"],
                    ["seller", "Seller"],
                    ["reviews", "Reviews"],
                    ["about", "About"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mobileDetailTab === id}
                    onClick={() => setMobileDetailTab(id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      mobileDetailTab === id
                        ? "bg-[#15803d] text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="flex shrink-0 items-center gap-1 border-l border-gray-200 pl-2"
                role="group"
                aria-label="Contact"
              >
                <button
                  type="button"
                  disabled={!canMessageSeller || isOwner}
                  onClick={() => scrollToInlineChat()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#15803d]/30 bg-white text-[#15803d] shadow-sm transition hover:bg-[#15803d] hover:text-white disabled:pointer-events-none disabled:opacity-40"
                  title="Message seller on this page"
                  aria-label="Message seller on this page"
                >
                  <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </button>
                <a
                  href={callHref}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#15803d]/30 bg-white text-[#15803d] shadow-sm transition hover:bg-[#15803d] hover:text-white"
                  title={sellerTelHref ? "Call seller" : "Call GreenHub support"}
                  aria-label={sellerTelHref ? "Call seller" : "Call GreenHub support"}
                >
                  <Phone className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </a>
              </div>
            </div>

            <div className="mb-3 hidden items-center justify-end gap-2 md:flex" role="group" aria-label="Contact">
              <button
                type="button"
                disabled={!canMessageSeller || isOwner}
                onClick={() => scrollToInlineChat()}
                className="inline-flex items-center gap-2 rounded-full border border-[#15803d]/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#15803d] shadow-sm transition hover:bg-[#15803d] hover:text-white disabled:pointer-events-none disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                Message seller
              </button>
              <a
                href={callHref}
                className="inline-flex items-center gap-2 rounded-full border border-[#15803d]/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#15803d] shadow-sm transition hover:bg-[#15803d] hover:text-white"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                Call
              </a>
            </div>

            <div
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "details" ? "block" : "hidden md:block",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2 md:mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Listing</h2>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className="shrink-0 rounded-lg border border-[#15803d]/40 bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#15803d] hover:bg-[#dcfce7]"
                  >
                    Edit product
                  </button>
                ) : null}
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 leading-snug tracking-tight">
                {product.title}
              </h1>
              <p className="text-2xl md:text-3xl font-bold text-[#15803d] mt-3 tabular-nums">{priceDisplay}</p>
              <PriceNegotiation
                productId={foundProduct.id}
                listingPrice={priceNum}
                sellerId={sellerPeerId}
                isOwner={isOwner}
                formatPrice={formatPrice}
              />
              <MarketPricePrediction
                title={String(product.title)}
                category={String(product.category)}
                description={product.description}
                currentPrice={priceNum}
                relatedListingCount={relatedProducts.length}
              />
              <SimilarProductsLinks productTitle={String(product.title)} />
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
                  <Heart
                    className={`w-3.5 h-3.5 ${liked ? "fill-red-500 text-red-500" : "text-gray-400"}`}
                    fill={liked ? "currentColor" : "none"}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {likeCount} likes
                </span>
              </div>
            </div>

            <section
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "seller" ? "block" : "hidden md:block",
              )}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Seller</h2>
              {sellerPeerId ? (
                <Link
                  to={`/profile/${sellerPeerId}`}
                  className="flex items-start gap-3 rounded-xl p-1 -m-1 transition-colors hover:bg-gray-50/90"
                >
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
                      {sellerIdVerified ? (
                        <VerifiedBadge title="Verified seller" size="md" className="shrink-0" />
                      ) : null}
                      {sellerIdVerified && sellerProfile?.verified_badge?.trim() ? (
                        <span className="verified-badge">{sellerProfile.verified_badge.trim()}</span>
                      ) : null}
                      {sellerVerifiedAdvertiser ? <VerifiedAdvertiserBadge size="md" /> : null}
                      {!sellerIdVerified && sellerTierLower === "crown" ? (
                        <BadgeCheck className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" title="Crown tier" />
                      ) : !sellerIdVerified && sellerTierLower === "blue" ? (
                        <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-400 shrink-0" title="Blue tier" />
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
                </Link>
              ) : (
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
                      {sellerIdVerified ? (
                        <VerifiedBadge title="Verified seller" size="md" className="shrink-0" />
                      ) : null}
                      {sellerIdVerified && sellerProfile?.verified_badge?.trim() ? (
                        <span className="verified-badge">{sellerProfile.verified_badge.trim()}</span>
                      ) : null}
                      {sellerVerifiedAdvertiser ? <VerifiedAdvertiserBadge size="md" /> : null}
                      {!sellerIdVerified && sellerTierLower === "crown" ? (
                        <BadgeCheck className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" title="Crown tier" />
                      ) : !sellerIdVerified && sellerTierLower === "blue" ? (
                        <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-400 shrink-0" title="Blue tier" />
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
              )}
              {canMessageSeller ? (
                <div id="product-inline-chat" className="mt-4 scroll-mt-24">
                  <ProductDetailInlineChat
                    sellerId={sellerPeerId}
                    sellerName={product.seller.name}
                    sellerCreatedAt={sellerProfile?.created_at ?? null}
                    sellerVerified={sellerIdVerified}
                    sellerOnline={sellerOnline}
                    sellerLastActive={sellerProfile?.last_active ?? null}
                    productId={foundProduct.id != null ? foundProduct.id : id}
                    authUserId={authUser?.id}
                    isOwner={isOwner}
                    sellerTelHref={sellerTelHref}
                    whatsappHref={whatsappHref}
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-gray-50 px-3 py-3 text-center text-xs text-gray-500 ring-1 ring-gray-100">
                  Seller account unavailable for chat.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2">
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

            <section
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "reviews" ? "block" : "hidden md:block",
              )}
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product reviews</h2>
                {authUser &&
                String(foundProduct.seller_id ?? foundProduct.sellerId ?? "").trim() !== authUser.id ? (
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
              ) : productReviews.length === 0 ? (
                <p className="text-sm text-gray-500">No written reviews yet. Be the first to review this item.</p>
              ) : (
                <ul className="space-y-4">
                  {productReviews.map((r) => (
                    <li key={r.id} className="rounded-xl bg-gray-50/90 p-3 ring-1 ring-gray-100">
                      <div className="flex items-start gap-3">
                        <Link
                          to={`/profile/${r.user_id}`}
                          className="shrink-0 rounded-full ring-1 ring-gray-100 hover:opacity-90"
                          aria-label={`View ${r.reviewer_name}'s profile`}
                        >
                          <img
                            src={r.reviewer_avatar}
                            alt=""
                            className="h-10 w-10 rounded-full bg-gray-100 object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              to={`/profile/${r.user_id}`}
                              className="text-sm font-medium text-gray-900 hover:underline"
                            >
                              {r.reviewer_name}
                            </Link>
                            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                                />
                              ))}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400">{formatProductReviewDate(r.created_at)}</p>
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

            <section
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "reviews" ? "block" : "hidden md:block",
              )}
            >
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
              {sellerReviewsPreview.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews for this seller yet.</p>
              ) : (
                <ul className="space-y-3">
                  {sellerReviewsPreview.map((r) => (
                    <li key={r.id} className="rounded-xl bg-gray-50/90 ring-1 ring-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/profile/${r.reviewer_id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {r.reviewer_name}
                        </Link>
                        <span className="flex items-center gap-0.5 shrink-0" aria-hidden>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{formatProductReviewDate(r.created_at)}</p>
                      {r.comment?.trim() ? (
                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.comment.trim()}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "about" ? "block" : "hidden md:block",
              )}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Description</h2>
              {product.description ? (
                <>
                  {product.description.split("\n\n").map((para, idx) => (
                    <p key={idx} className="mb-2 text-xs text-gray-600 leading-snug last:mb-0">
                      {para}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-sm text-gray-500">No description provided.</p>
              )}
            </section>

            <section
              className={cn(
                "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5",
                mobileDetailTab === "about" ? "block" : "hidden md:block",
              )}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Delivery options</h2>
              {product.deliveryOptions.length === 0 && product.intlDeliveryOptions.length === 0 ? (
                <p className="text-sm text-gray-500">No delivery options listed for this item.</p>
              ) : (
                <>
                  {product.deliveryOptions.length > 0 ? (
                    <ul className="space-y-0 divide-y divide-gray-100">
                      {product.deliveryOptions.map((option, index) => (
                        <li key={`loc-${index}`} className="flex items-center justify-between gap-4 text-sm py-3 first:pt-0">
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
                  ) : null}
                  {product.intlDeliveryOptions.length > 0 ? (
                    <>
                      {product.deliveryOptions.length > 0 ? (
                        <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          International shipping
                        </p>
                      ) : null}
                      <ul className="space-y-0 divide-y divide-gray-100">
                        {product.intlDeliveryOptions.map((option, index) => (
                          <li
                            key={`intl-${index}`}
                            className="flex items-center justify-between gap-4 text-sm py-3 first:pt-0"
                          >
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
                    </>
                  ) : null}
                </>
              )}
            </section>

            <section
              className={cn(
                "rounded-2xl bg-amber-50/90 px-4 py-4 text-sm text-gray-800 ring-1 ring-amber-100/80",
                mobileDetailTab === "about" ? "block" : "hidden md:block",
              )}
            >
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
          {isOwner ? (
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            >
              Edit listing
            </button>
          ) : (
            <>
              {canMessageSeller ? (
                <button
                  type="button"
                  onClick={() => scrollToInlineChat()}
                  className="hidden sm:inline-flex px-4 py-3 rounded-xl ring-1 ring-gray-200 text-sm font-semibold text-gray-800 items-center justify-center hover:bg-gray-50"
                >
                  Message seller
                </button>
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
            </>
          )}
        </div>
      </div>

      <EditProductModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        product={foundProduct}
        onSaved={() => {
          void refetchProduct();
          toast.success("Listing updated");
        }}
      />
    </div>
  );
}
