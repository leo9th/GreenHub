import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { ArrowLeft, Share2, Heart, Star, MapPin, Shield, MessageCircle, Phone, ShoppingCart, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import {  } from "../data/mockData";
import { useCurrency } from "../hooks/useCurrency";
import { useCart } from "../context/CartContext";
import { supabase } from "../../lib/supabase";
import { getAvatarUrl } from "../utils/getAvatar";
import { getProductPrice } from "../utils/getProductPrice";
import { activeProductsQuery, mapProductRow } from "../utils/productSearch";
import { toast } from "sonner";
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
  const [relatedProducts, setRelatedProducts] = useState<
    Array<{ id: string | number; title: string; image: string; price: number; location: string }>
  >([]);

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

      const { data, error } = await activeProductsQuery(supabase)
        .neq("id", serverProduct.id)
        .ilike("category", raw)
        .limit(6);

      if (cancelled) return;
      if (error) {
        console.warn("Related products:", error.message);
        setRelatedProducts([]);
        return;
      }

      const rows = (data ?? []).map((r) => mapProductRow(r as Record<string, unknown>));
      const placeholder = "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400";
      setRelatedProducts(
        rows.map((r) => ({
          id: r.id as string | number,
          title: String((r as { title?: string }).title ?? ""),
          image: String((r as { image?: string }).image ?? "") || placeholder,
          price: typeof r.price === "number" ? r.price : getProductPrice(r as { price?: unknown; price_local?: unknown }),
          location: String((r as { location?: string }).location ?? ""),
        }))
      );
    };

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [serverProduct?.id, serverProduct?.category]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-gray-600">
        Loading…
      </div>
    );
  }

  if (!foundProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Product not found</h2>
          <p className="text-gray-600 mb-4">The product you&apos;re looking for doesn&apos;t exist.</p>
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 bg-[#22c55e] text-white rounded-lg font-medium">
            Go Back
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="p-2 relative active:scale-95 transition-transform">
              <Share2 className="w-5 h-5 text-gray-600 hover:text-[#22c55e] transition-colors" />
            </button>
            <button onClick={() => setIsFavorite(!isFavorite)} className="p-2 relative active:scale-95 transition-transform">
              <Heart className={`w-5 h-5 transition-colors ${isFavorite ? "fill-[#ef4444] text-[#ef4444]" : "text-gray-600 hover:text-[#ef4444]"}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:grid md:grid-cols-2 md:gap-8 md:items-start md:py-6">
        {/* Image Gallery */}
        <div className="relative bg-white md:px-4">
          <div className="relative aspect-square max-w-7xl mx-auto md:rounded-2xl md:overflow-hidden md:border md:border-gray-200">
          <img
            src={product.images[currentImageIndex]}
            alt={product.title}
            className="w-full h-full object-cover"
          />
          {product.images.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                {product.images.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${index === currentImageIndex ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
          <span className="absolute top-4 left-4 bg-[#22c55e] text-white text-sm px-3 py-1 rounded-full">
            {product.condition}
          </span>
        </div>
        </div>

      {/* Content */}
      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4 md:px-4 md:py-0">
        {/* Price & Title */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900 flex-1">{product.title}</h1>
          </div>
          <p className="text-2xl font-bold text-[#22c55e] mb-3">{(product.price)}</p>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{product.location}</span>
            </div>
            <span>•</span>
            <span>{product.postedDate}</span>
            <span>•</span>
            <span>{product.views} views</span>
          </div>
        </div>

        {/* Seller Card */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Seller Information</h2>
          <div className="flex items-center gap-3 mb-3">
            <img src={product.seller.avatar} alt={product.seller.name} className="w-12 h-12 rounded-full" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 flex items-center gap-1">
                  {product.seller.name}
                  {product.seller.tier === 'crown' && <span title="Crown Verified"><BadgeCheck className="w-[18px] h-[18px] ml-0.5 text-white fill-yellow-500 drop-shadow-sm" /></span>}
                  {product.seller.tier === 'blue' && <span title="Blue Verified"><BadgeCheck className="w-[18px] h-[18px] ml-0.5 text-white fill-blue-500 drop-shadow-sm" /></span>}
                  {product.seller.tier === 'standard' && <span title="Standard Verified"><BadgeCheck className="w-[18px] h-[18px] ml-0.5 text-white fill-green-500 drop-shadow-sm" /></span>}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-sm mt-1">
                <Star className="w-3 h-3 fill-[#eab308] text-[#eab308]" />
                <span className="text-gray-600">{product.seller.rating}</span>
                <span className="text-gray-400">({product.seller.reviews} reviews)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
            <span>Member since {product.seller.memberSince}</span>
            <span>Response: {product.seller.responseTime}</span>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/messages/${product.seller.id}`}
              className="flex-1 py-2 bg-[#22c55e] text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Link>
            <a href={`tel:${"+2348012345678"}`} className="px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
              <Phone className="w-4 h-4 text-gray-600" />
            </a>
            <Link
              to={`/seller/${product.seller.id}/reviews`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
            >
              View Profile
            </Link>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{product.description}</p>
        </div>

        {/* Delivery Options */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Delivery Options</h2>
          <div className="space-y-3">
            {product.deliveryOptions.map((option, index) => (
              <div key={index} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-gray-800">{option.name}</p>
                  <p className="text-sm text-gray-600">{option.duration}</p>
                </div>
                <p className="font-semibold text-gray-800">
                  {option.fee === 0 ? "Free" : (option.fee)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Tips */}
        <div className="bg-[#eab308]/10 border border-[#eab308]/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-[#eab308] mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Safety Tips</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Meet in a safe public place</li>
                <li>• Check the item before you buy</li>
                <li>• Pay only after collecting item</li>
                <li>• Don't share sensitive financial info</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Related Products — same category + active only (fetched when listing is from Supabase) */}
        {relatedProducts.length > 0 ? (
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Related Products</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relatedProducts.map((item) => (
                <Link
                  key={String(item.id)}
                  to={`/products/${item.id}`}
                  className="bg-white rounded-lg overflow-hidden border border-gray-200"
                >
                  <div className="aspect-square bg-gray-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">{item.title}</h3>
                    <p className="text-lg font-bold text-gray-900 mb-1">{formatPrice(item.price)}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{item.location}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="h-20 md:hidden"></div>
      </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="max-w-7xl mx-auto flex gap-2 sm:gap-3">
          <Link
            to={`/messages/${product.seller.id}`}
            className="px-3 sm:px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <MessageCircle className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Chat</span>
          </Link>
          <button 
            onClick={() => {
              addToCart({
                id: product.id.toString(),
                title: product.title,
                price: product.price,
                image: product.images[0],
                quantity: 1,
                sellerId: product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0].fee
              });
              toast.success("Added to cart");
            }}
            className="flex-1 py-3 bg-[#f97316] text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#ea580c] transition-colors shadow-sm"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden sm:inline">Add to Cart</span>
          </button>
          <button 
            onClick={() => {
              addToCart({
                id: product.id.toString(),
                title: product.title,
                price: product.price,
                image: product.images[0],
                quantity: 1,
                sellerId: product.seller.id.toString(),
                deliveryFee: product.deliveryOptions[0].fee
              });
              navigate("/checkout");
            }}
            className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-colors shadow-sm"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
