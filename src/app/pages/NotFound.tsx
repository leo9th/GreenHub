import { Link, useNavigate } from "react-router";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-7xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-[#22c55e] mb-2">404</div>
          <div className="text-6xl mb-4">🔍</div>
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 bg-[#22c55e] text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>

          <Link
            to="/"
            className="w-full py-3 border-2 border-[#22c55e] text-[#22c55e] rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#22c55e]/5 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Homepage
          </Link>

          <Link
            to="/products"
            className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Search className="w-5 h-5" />
            Browse Products
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4">Popular pages:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/products" className="text-[#22c55e] hover:underline">
              Products
            </Link>
            <Link to="/cart" className="text-[#22c55e] hover:underline">
              Cart
            </Link>
            <Link to="/orders" className="text-[#22c55e] hover:underline">
              Orders
            </Link>
            <Link to="/messages" className="text-[#22c55e] hover:underline">
              Messages
            </Link>
            <Link to="/profile" className="text-[#22c55e] hover:underline">
              Profile
            </Link>
            <Link to="/help" className="text-[#22c55e] hover:underline">
              Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
