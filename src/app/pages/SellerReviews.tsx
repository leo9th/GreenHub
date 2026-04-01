import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Star, ThumbsUp, MoreVertical } from "lucide-react";
import { getAvatarUrl } from "../../utils/getAvatar";

export default function SellerReviews() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");

  const seller = {
    id: 1,
    name: "Chidi Okonkwo",
    avatar: getAvatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200", "male", "Chidi Okonkwo"),
    rating: 4.8,
    totalReviews: 156,
    verified: true,
  };

  const ratingBreakdown = [
    { stars: 5, count: 120, percentage: 77 },
    { stars: 4, count: 25, percentage: 16 },
    { stars: 3, count: 8, percentage: 5 },
    { stars: 2, count: 2, percentage: 1 },
    { stars: 1, count: 1, percentage: 1 },
  ];

  const reviews = [
    {
      id: 1,
      user: {
        name: "Amina Yusuf",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", "female", "Amina Yusuf"),
      },
      rating: 5,
      date: "2 days ago",
      review: "Excellent seller! Product was exactly as described and delivered quickly. Communication was great throughout the process. Highly recommended!",
      product: "iPhone 13 Pro Max 256GB",
      images: [
        "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=300",
      ],
      helpful: 12,
    },
    {
      id: 2,
      user: {
        name: "Tunde Adebayo",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", "male", "Tunde Adebayo"),
      },
      rating: 5,
      date: "5 days ago",
      review: "Great experience! The phone was in perfect condition. Seller was very professional and responsive to all my questions.",
      product: "Samsung Galaxy S21",
      images: [],
      helpful: 8,
    },
    {
      id: 3,
      user: {
        name: "Fatima Mohammed",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", "female", "Fatima Mohammed"),
      },
      rating: 4,
      date: "1 week ago",
      review: "Good product and fair price. Delivery took a bit longer than expected but overall satisfied with the purchase.",
      product: "Sony WH-1000XM4 Headphones",
      images: [],
      helpful: 5,
    },
    {
      id: 4,
      user: {
        name: "Emeka Nwosu",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100", "male", "Emeka Nwosu"),
      },
      rating: 5,
      date: "2 weeks ago",
      review: "Amazing seller! Product arrived in perfect condition, well packaged. Seller was very helpful and answered all my questions promptly. Will definitely buy again!",
      product: "MacBook Pro M1",
      images: [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
        "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=300",
      ],
      helpful: 15,
    },
  ];

  const filteredReviews = filter === "all"
    ? reviews
    : reviews.filter(review => review.rating === parseInt(filter));

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Seller Reviews</h1>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Seller Info */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={seller.avatar} alt={seller.name} className="w-16 h-16 rounded-full" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-gray-800">{seller.name}</h2>
                {seller.verified && (
                  <span className="text-[#22c55e] text-sm">✓</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-[#eab308] text-[#eab308]" />
                  <span className="font-semibold text-gray-800">{seller.rating}</span>
                </div>
                <span className="text-sm text-gray-600">
                  ({seller.totalReviews} reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-2">
            {ratingBreakdown.map((item) => (
              <button
                key={item.stars}
                onClick={() => setFilter(item.stars.toString() as any)}
                className={`w-full flex items-center gap-3 ${filter === item.stars.toString() ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
              >
                <span className="text-sm text-gray-700 w-8">{item.stars}★</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#eab308]"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "all"
                ? "bg-[#22c55e] text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            All Reviews
          </button>
          {[5, 4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => setFilter(stars.toString() as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === stars.toString()
                  ? "bg-[#22c55e] text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              {stars} ★
            </button>
          ))}
        </div>

        {/* Reviews List */}
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={review.user.avatar}
                  alt={review.user.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-800">{review.user.name}</h3>
                    <button className="p-1">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= review.rating
                              ? "fill-[#eab308] text-[#eab308]"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{review.date}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{review.product}</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-3">{review.review}</p>

              {review.images.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {review.images.map((image, index) => (
                    <div
                      key={index}
                      className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
                    >
                      <img src={image} alt="Review" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#22c55e]">
                <ThumbsUp className="w-4 h-4" />
                <span>Helpful ({review.helpful})</span>
              </button>
            </div>
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⭐</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No reviews found</h3>
            <p className="text-gray-600 text-sm">
              No {filter}-star reviews for this seller yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
