import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Star, Upload, X } from "lucide-react";

export default function WriteReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const productId = searchParams.get("productId");

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const product = {
    id: 1,
    image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200",
    title: "iPhone 13 Pro Max 256GB",
    seller: "Chidi Okonkwo",
  };

  const handleImageUpload = () => {
    // Simulate image upload
    const mockImage = "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400";
    if (images.length < 3) {
      setImages([...images, mockImage]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit review logic
    console.log({ rating, review, images });
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Write Review</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Product Info */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 line-clamp-2 mb-1">{product.title}</h3>
              <p className="text-sm text-gray-600">by {product.seller}</p>
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            Rate your experience *
          </label>
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
                    star <= (hoveredRating || rating)
                      ? "fill-[#eab308] text-[#eab308]"
                      : "text-gray-300"
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

        {/* Review Text */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">
            Your Review *
          </label>
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

        {/* Photos */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            Add Photos (Optional)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={image} alt={`Review ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                type="button"
                onClick={handleImageUpload}
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-[#22c55e] hover:text-[#22c55e] transition-colors"
              >
                <Upload className="w-6 h-6 mb-1" />
                <span className="text-xs">Upload</span>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Add up to 3 photos to help others
          </p>
        </div>

        {/* Review Guidelines */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Review Guidelines</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Be honest and specific about your experience</li>
            <li>• Focus on the product quality and seller service</li>
            <li>• Don't include personal information</li>
            <li>• Keep it respectful and constructive</li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={rating === 0 || review.length < 20}
          className="w-full py-3 bg-[#22c55e] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Review
        </button>
      </form>
    </div>
  );
}
