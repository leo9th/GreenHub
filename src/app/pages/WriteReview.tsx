import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

type ProductInfo = {
  title: string;
  image: string | null;
  seller_id: string;
  sellerName: string;
};

export default function WriteReview() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const productIdParam = searchParams.get("productId");
  const { user: authUser, loading: authLoading } = useAuth();

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!orderId?.trim() || !productIdParam?.trim() || !authUser?.id) {
      setProduct(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: ord, error: oErr } = await supabase.from("orders").select("buyer_id").eq("id", orderId.trim()).maybeSingle();

      if (oErr) throw oErr;
      if (!ord || String((ord as { buyer_id: string }).buyer_id) !== authUser.id) {
        toast.error("This order was not found.");
        navigate("/orders", { replace: true });
        return;
      }

      const { data: line, error: lErr } = await supabase
        .from("order_items")
        .select("seller_id, product_title, product_image")
        .eq("order_id", orderId.trim())
        .eq("product_id", productIdParam.trim())
        .maybeSingle();

      if (lErr) throw lErr;

      const { data: prow, error: pErr } = await supabase
        .from("products")
        .select("title, image, seller_id")
        .eq("id", productIdParam.trim())
        .maybeSingle();

      if (pErr) throw pErr;

      const sellerId = (line as { seller_id?: string } | null)?.seller_id || (prow as { seller_id?: string } | null)?.seller_id;
      if (!sellerId) {
        toast.error("Could not determine seller for this item.");
        navigate(-1);
        return;
      }

      const title =
        (line as { product_title?: string } | null)?.product_title?.trim() ||
        (prow as { title?: string } | null)?.title?.trim() ||
        "Product";
      const image =
        (line as { product_image?: string } | null)?.product_image ||
        (prow as { image?: string } | null)?.image ||
        null;

      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", sellerId).maybeSingle();

      setProduct({
        title,
        image,
        seller_id: sellerId,
        sellerName: ((prof as { full_name?: string } | null)?.full_name || "Seller").trim(),
      });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, orderId, productIdParam, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !product || !productIdParam?.trim()) return;
    if (rating < 1 || review.trim().length < 20) {
      toast.error("Add a star rating and at least 20 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const pidNum = Number(productIdParam.trim());
      const row = {
        seller_id: product.seller_id,
        reviewer_id: authUser.id,
        product_id: Number.isFinite(pidNum) ? pidNum : null,
        rating,
        comment: review.trim(),
      };

      const { error } = await supabase.from("seller_reviews").insert(row);
      if (error) throw error;
      toast.success("Thank you — your review was submitted.");
      navigate(-1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-700 mb-4">Could not load this product for review.</p>
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Write Review</h1>
        </div>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-lg p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {product.image ? (
                <img src={product.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 line-clamp-2 mb-1">{product.title}</h3>
              <p className="text-sm text-gray-600">by {product.sellerName}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">Rate your experience *</label>
          <div className="flex gap-2 justify-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-12 h-12 transition-colors ${
                    star <= (hoveredRating || rating) ? "fill-[#eab308] text-[#eab308]" : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            {rating === 0 && "Tap to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">Your Review *</label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            required
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="Share your experience with this product and seller..."
          />
          <p className="text-xs text-gray-600 mt-2">
            Minimum 20 characters ({review.length}/20)
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Review Guidelines</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Be honest and specific about your experience</li>
            <li>• Focus on the product quality and seller service</li>
            <li>• Don&apos;t include personal information</li>
            <li>• Keep it respectful and constructive</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={rating === 0 || review.length < 20 || submitting}
          className="w-full py-3 bg-[#22c55e] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </form>
    </div>
  );
}
