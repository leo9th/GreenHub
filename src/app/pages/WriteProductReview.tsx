import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

type ProductRow = {
  id: number | string;
  title: string;
  image: string | null;
  seller_id: string;
};

type ExistingReview = {
  id: string;
  rating: number;
  comment: string;
};

export default function WriteProductReview() {
  const navigate = useNavigate();
  const { productId: productIdParam } = useParams<{ productId: string }>();
  const { user: authUser, loading: authLoading } = useAuth();

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [sellerName, setSellerName] = useState("Seller");
  const [existingReview, setExistingReview] = useState<ExistingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const rawId = productIdParam?.trim();
    if (!rawId || !authUser?.id) {
      setProduct(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: prow, error: pErr } = await supabase
        .from("products")
        .select("id, title, image, seller_id")
        .eq("id", rawId)
        .maybeSingle();

      if (pErr) throw pErr;
      if (!prow) {
        toast.error("Product not found.");
        setProduct(null);
        return;
      }

      const row = prow as ProductRow;
      if (String(row.seller_id) === authUser.id) {
        toast.error("You can’t review your own listing.");
        navigate(`/products/${rawId}`, { replace: true });
        return;
      }

      setProduct(row);

      const { data: prof } = await supabase
        .from("profiles_public")
        .select("full_name")
        .eq("id", row.seller_id)
        .maybeSingle();

      setSellerName(((prof as { full_name?: string } | null)?.full_name || "Seller").trim());

      const pid =
        typeof row.id === "number" && Number.isFinite(row.id) ? row.id : Number(row.id);
      if (!Number.isFinite(pid)) {
        setProduct(null);
        return;
      }

      const { data: rev, error: rErr } = await supabase
        .from("product_reviews")
        .select("id, rating, comment")
        .eq("product_id", pid)
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (rErr && rErr.code !== "PGRST116") {
        if (rErr.message.includes("product_reviews") && rErr.message.includes("does not exist")) {
          toast.error("Product reviews aren’t set up yet. Run the product_reviews SQL migration in Supabase.");
          setProduct(null);
          return;
        }
        throw rErr;
      }

      if (rev) {
        const r = rev as ExistingReview;
        setExistingReview(r);
        setRating(Math.min(5, Math.max(1, Number(r.rating) || 1)));
        setComment(String(r.comment ?? ""));
      } else {
        setExistingReview(null);
        setRating(0);
        setComment("");
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, productIdParam, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true, state: { from: `/products/${productIdParam}/write-review` } });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load, productIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !product) return;
    const pid = typeof product.id === "number" ? product.id : Number(product.id);
    if (!Number.isFinite(pid)) return;
    if (rating < 1 || rating > 5) {
      toast.error("Choose a star rating from 1 to 5.");
      return;
    }

    setSubmitting(true);
    try {
      if (existingReview) {
        const { error } = await supabase
          .from("product_reviews")
          .update({ rating, comment: comment.trim() })
          .eq("id", existingReview.id)
          .eq("user_id", authUser.id);
        if (error) throw error;
        toast.success("Your review was updated.");
      } else {
        const { error } = await supabase.from("product_reviews").insert({
          product_id: pid,
          user_id: authUser.id,
          rating,
          comment: comment.trim(),
        });
        if (error) {
          if (error.code === "23505") {
            toast.error("You already reviewed this product.");
            void load();
            return;
          }
          throw error;
        }
        toast.success("Thanks — your review was posted.");
      }
      navigate(`/products/${product.id}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit review";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gray-50 text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center bg-gray-50 px-4">
        <p className="mb-4 text-gray-700">Could not load this product.</p>
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm text-white">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate(`/products/${product.id}`)} className="-ml-2 rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{existingReview ? "Edit review" : "Write a review"}</h1>
        </div>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {product.image ? (
                <img src={product.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gray-200" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-medium text-gray-900">{product.title}</h2>
              <p className="text-sm text-gray-600">Sold by {sellerName}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <p className="mb-3 font-semibold text-gray-900">Rating *</p>
          <div className="mb-2 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
              >
                <Star
                  className={`h-11 w-11 transition-colors sm:h-12 sm:w-12 ${
                    star <= (hoveredRating || rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            {rating === 0 && "Tap a star to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very good"}
            {rating === 5 && "Excellent"}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <label htmlFor="review-comment" className="mb-2 block font-semibold text-gray-900">
            Comment
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="What did you think of this product?"
          />
        </div>

        <button
          type="submit"
          disabled={rating < 1 || submitting}
          className="w-full rounded-xl bg-[#22c55e] py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : existingReview ? "Update review" : "Submit review"}
        </button>
      </form>
    </div>
  );
}
