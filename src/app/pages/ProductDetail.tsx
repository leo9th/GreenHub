import { useState, useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link, useParams, useNavigate } from "react-router";
import { ArrowLeft, Share2, Heart, Star, MapPin, ShoppingCart, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { useCurrency } from "../hooks/useCurrency";
import { useCart } from "../context/CartContext";
import { supabase } from "../../lib/supabase";
import { getAvatarUrl } from "../utils/getAvatar";
import { getProductPrice } from "../utils/getProductPrice";
import { activeProductsQuery, mapProductRow } from "../utils/productSearch";
import { toast } from "sonner";

function shuffleRelatedProducts<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

type RelatedCarouselItem = {
  id: string | number;
  title: string;
  image: string;
  price: number;
  location: string;
  condition: string;
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
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
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

/** Same seller’s other listings — aligned grid (side by side, wraps in neat rows) */
function MoreFromSellerGrid({
  items,
  formatPrice,
}: {
  items: RelatedCarouselItem[];
  formatPrice: (amount: number | null | undefined) => string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item) => (
        <Link
          key={String(item.id)}
          to={`/products/${item.id}`}
          className="group flex flex-col h-full rounded-xl overflow-hidden bg-gray-50/80 ring-1 ring-gray-100 hover:ring-[#22c55e]/35 hover:shadow-md transition-shadow"
        >
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gray-100">
            <img
              src={item.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute top-2 left-2 bg-[#16a34a] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
              {item.condition || "—"}
            </span>
          </div>
          <div className="p-2.5 flex flex-col flex-1 min-h-[3.25rem]">
            <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug mb-1 flex-1">
              {item.title}
            </p>
            <p className="text-sm font-bold text-gray-900 tabular-nums mt-auto">{formatPrice(item.price)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const formatPrice = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [serverProduct, setServerProduct] = useState<any>(null);
  const [isServerProductLoading, setIsServerProductLoading] = useState<boolean>(true);
  const [relatedProducts, setRelatedProducts] = useState<RelatedCarouselItem[]>([]);
  const [moreFromSeller, setMoreFromSeller] = useState<RelatedCarouselItem[]>([]);

  const CUSTOM_PRODUCTS_KEY = "greenhub-custom-products";
  const customProductsRaw = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
  const customProducts = customProductsRaw ? JSON.parse(customProductsRaw) : [];

  const defaultProducts = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400",
      title: "iPhone 13 Pro Max 256GB",
      price: 450000,
      location: "Ikeja, Lagos",
      rating: 4.8,
      reviews: 24,
      condition: "Like New",
      category: "electronics",
      sellerTier: "crown",
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      title: "Nike Air Max 270 Shoes",
      price: 25000,
      location: "Wuse, Abuja",
      rating: 5.0,
      reviews: 18,
      condition: "New",
      category: "fashion",
      sellerTier: "blue"
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      title: "Sony WH-1000XM4 Headphones",
      price: 85000,
      location: "Victoria Island, Lagos",
      rating: 4.5,
      reviews: 32,
      condition: "Good",
      category: "electronics",
      sellerTier: "standard"
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
      title: "Timex Classic Watch",
      price: 15000,
      location: "Enugu",
      rating: 4.7,
      reviews: 12,
      condition: "Like New",
      category: "fashion",
      sellerTier: "crown"
    },
    {
      id: 5,
      image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400",
      title: "Samsung Galaxy S21",
      price: 220000,
      location: "Lekki, Lagos",
      rating: 4.9,
      reviews: 45,
      condition: "New",
      category: "electronics",
      sellerTier: "unverified"
    },
    {
      id: 6,
      image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
      title: "Adidas Sneakers",
      price: 18000,
      location: "Garki, Abuja",
      rating: 4.6,
      reviews: 20,
      condition: "Good",
      category: "fashion",
      sellerTier: "blue"
    },
  ];

  const allProducts = [...customProducts, ...defaultProducts];
  /** URL `products/:id` — pass through trimmed string so PostgREST matches int/bigint/uuid PKs without Number() precision loss */
  const normalizeRouteProductId = (raw: string | undefined): string | null => {
    if (raw == null) return null;
    const t = raw.trim();
    return t || null;
  };

  const foundProduct =
    serverProduct ?? (!isServerProductLoading ? allProducts.find((p: any) => p.id.toString() === id) : null);

  useEffect(() => {
    if (!serverProduct?.id) return;
    const pid = serverProduct.id;
    const key = `gh_view_${pid}`;
    if (import.meta.env.DEV) {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
    const asNum = typeof pid === "number" ? pid : Number(pid);
    if (!Number.isFinite(asNum)) return;
    void supabase.rpc("increment_product_views", { p_product_id: asNum }).then(({ error }) => {
      if (error) console.warn("increment_product_views:", error.message);
    });
  }, [serverProduct?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadServerProduct = async () => {
      const idForQuery = normalizeRouteProductId(id);
      if (idForQuery == null) {
        setServerProduct(null);
        setIsServerProductLoading(false);
        return;
      }

      setIsServerProductLoading(true);
      setServerProduct(null);

      const { data, error } = await supabase.from("products").select("*").eq("id", idForQuery).maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("ProductDetail:", error.message);
        setServerProduct(null);
        setIsServerProductLoading(false);
        return;
      }

      if (data) {
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
      const placeholder = "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400";
      const mapped = rows.map((r) => ({
        id: r.id as string | number,
        title: String((r as { title?: string }).title ?? ""),
        image: String((r as { image?: string }).image ?? "") || placeholder,
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
      const placeholder = "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400";
      setMoreFromSeller(
        rows.map((r) => ({
          id: r.id as string | number,
          title: String((r as { title?: string }).title ?? ""),
          image: String((r as { image?: string }).image ?? "") || placeholder,
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
    if (foundProduct?.sellerId) {
      if (typeof foundProduct.sellerId === 'string' && foundProduct.sellerId.length > 10) { // Supabase UUID lookup
        supabase.from('profiles').select('*').eq('id', foundProduct.sellerId).single()
          .then(({ data }) => {
            if (data) setSellerProfile(data);
          })
          .catch(console.error);
      }
    }
  }, [foundProduct?.sellerId]);

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

  const product = {
    id: foundProduct.id,
    title: foundProduct.title,
    price: foundProduct.price,
    images: foundProduct.image ? [foundProduct.image] : ["https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800"],
    condition: foundProduct.condition || "Like New",
    category: foundProduct.category || "General",
    description: foundProduct.description || `${foundProduct.title} in excellent condition. Great value for your money. Please contact me for more details.`,
    location: foundProduct.location,
    postedDate: foundProduct.createdAt ? new Date(foundProduct.createdAt).toLocaleDateString() : "Just now",
    views: typeof foundProduct.views === "number" ? foundProduct.views : Number(foundProduct.views) || 0,
    seller: {
      id: foundProduct.sellerId || 1,
      name: sellerProfile?.full_name || foundProduct.sellerName || "GreenHub Seller",
      avatar: getAvatarUrl(
        sellerProfile?.avatar_url, 
        sellerProfile?.gender, 
        sellerProfile?.full_name || foundProduct.sellerName || "GreenHub Seller"
      ),
      rating: foundProduct.rating || 4.8,
      reviews: foundProduct.reviews || 0,
      verified: ['crown', 'blue', 'standard'].includes(foundProduct.sellerTier),
      memberSince: sellerProfile?.created_at 
        ? new Date(sellerProfile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) 
        : sellerProfile?.updated_at
          ? new Date(sellerProfile.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : "Jan 2023",
      responseTime: "Within hours",
      tier: foundProduct.sellerTier || "standard"
    },
    deliveryOptions: Array.isArray(foundProduct.deliveryOptions) && foundProduct.deliveryOptions.length > 0
      ? foundProduct.deliveryOptions.map((name: string) => ({ name, fee: 3000, duration: "2-3 days" }))
      : [
          { name: "GIGL", fee: 3000, duration: "2-3 days" },
          { name: "Pickup", fee: 0, duration: "Arrange with seller" },
        ],
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
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

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-28 md:pb-8">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
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
              onClick={() => setIsFavorite(!isFavorite)}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-600"
              aria-label="Save"
            >
              <Heart
                className={`w-[18px] h-[18px] ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-10 lg:gap-14 md:items-start">
          {/* Left: product image */}
          <div className="flex justify-center md:justify-start md:sticky md:top-14">
            <div className="relative w-full max-w-[480px] mx-auto">
              <div className="relative rounded-2xl overflow-hidden bg-gray-50 ring-1 ring-gray-100">
                <img
                  src={product.images[currentImageIndex]}
                  alt={product.title}
                  className="block w-full max-w-[480px] h-auto mx-auto object-contain"
                />
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
                <span className="absolute top-3 left-3 bg-[#15803d] text-white text-[11px] font-semibold px-2 py-1 rounded-lg">
                  {product.condition}
                </span>
              </div>
              {product.images.length > 1 && (
                <div className="mt-3 w-full max-w-[480px] mx-auto">
                  <div className="flex gap-2 overflow-x-auto pb-1 justify-center md:justify-start snap-x snap-mandatory">
                    {product.images.map((src, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentImageIndex(index)}
                        className={`relative shrink-0 snap-start rounded-lg overflow-hidden ring-2 transition-shadow w-24 sm:w-28 aspect-[16/9] ${
                          index === currentImageIndex
                            ? "ring-[#16a34a] shadow-md"
                            : "ring-transparent opacity-85 hover:opacity-100"
                        }`}
                        aria-label={`Show image ${index + 1}`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: details */}
          <div className="space-y-8 pt-8 md:pt-0">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 leading-snug tracking-tight">
                {product.title}
              </h1>
              <p className="text-2xl md:text-3xl font-bold text-[#15803d] mt-3 tabular-nums">{priceDisplay}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                {product.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                    {product.location}
                  </span>
                ) : null}
                {product.location ? <span className="text-gray-300">·</span> : null}
                <span>Listed {product.postedDate}</span>
                <span className="text-gray-300">·</span>
                <span>{product.views} views</span>
              </div>
            </div>

            <section className="pt-2 border-t border-gray-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Seller</h2>
              <div className="flex items-start gap-3">
                <img
                  src={product.seller.avatar}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover bg-gray-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-gray-900">{product.seller.name}</span>
                    {product.seller.tier === "crown" && (
                      <BadgeCheck className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" title="Crown verified" />
                    )}
                    {product.seller.tier === "blue" && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-400 shrink-0" title="Blue verified" />
                    )}
                    {product.seller.tier === "standard" && (
                      <BadgeCheck className="w-4 h-4 text-green-600 fill-green-500 shrink-0" title="Verified" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    <Star className="w-3 h-3 inline text-amber-400 fill-amber-400 align-[-2px] mr-0.5" aria-hidden />
                    {product.seller.rating} · {product.seller.reviews} reviews · Since {product.seller.memberSince}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Link
                  to={`/messages/${product.seller.id}`}
                  className="sm:flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] text-white text-sm font-semibold px-4 hover:bg-[#15803d]"
                >
                  Message seller
                </Link>
                <a
                  href="tel:+2348012345678"
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl ring-1 ring-gray-200 text-sm font-medium text-gray-800 px-4 hover:bg-gray-50"
                >
                  Call
                </a>
                <Link
                  to={`/seller/${product.seller.id}/reviews`}
                  className="col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center rounded-xl ring-1 ring-gray-200 text-sm font-medium text-gray-700 px-4 hover:bg-gray-50"
                >
                  Reviews
                </Link>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Description</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Delivery</h2>
              <ul className="space-y-3">
                {product.deliveryOptions.map((option, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-4 text-sm py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{option.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{option.duration}</p>
                    </div>
                    <p className="font-semibold text-gray-900 tabular-nums shrink-0">
                      {option.fee === 0 ? "Free" : formatPrice(option.fee)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl bg-amber-50/80 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Safety</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Meet in public when possible. Inspect the item before paying. Never share OTPs or bank PINs.
              </p>
            </section>
          </div>
        </div>

        {/* Full width below grid */}
        <div className="mt-12 md:mt-16 space-y-12 border-t border-gray-100 pt-10">
          {moreFromSeller.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">More from this seller</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">Other listings by {product.seller.name}</p>
              <MoreFromSellerGrid items={moreFromSeller} formatPrice={formatPrice} />
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

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2">
          <Link
            to={`/messages/${product.seller.id}`}
            className="hidden sm:inline-flex px-4 py-3 rounded-xl ring-1 ring-gray-200 text-sm font-semibold text-gray-800 items-center justify-center hover:bg-gray-50"
          >
            Chat
          </Link>
          <button
            type="button"
            onClick={() => {
              addToCart({
                id: product.id.toString(),
                title: product.title,
                price: product.price,
                image: product.images[0],
                quantity: 1,
                sellerId: product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0].fee,
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
                image: product.images[0],
                quantity: 1,
                sellerId: product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0].fee,
              });
              navigate("/checkout");
            }}
            className="flex-1 py-3 rounded-xl bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d]"
          >
            Buy now
          </button>
        </div>
      </div>
    </div>
  );
}
