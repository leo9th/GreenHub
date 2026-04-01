import { Link, useNavigate } from "react-router";
import { ArrowLeft, Star, Package, Heart, MapPin, Edit } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl } from "../utils/getAvatar";

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user: authUser, signOut } = useAuth();

  const user = {
    name: profile?.full_name || authUser?.user_metadata?.full_name || "Guest User",
    email: profile?.email || authUser?.email || "No email",
    phone: profile?.phone || authUser?.user_metadata?.phone || "No phone",
    avatar: getAvatarUrl(
      profile?.avatar_url || authUser?.user_metadata?.avatar_url,
      profile?.gender || authUser?.user_metadata?.gender,
      profile?.full_name || authUser?.user_metadata?.full_name || "Guest User"
    ),
    memberSince: "Joined Recently",
    location: profile?.state && profile?.lga ? `${profile.lga}, ${profile.state}` : profile?.address || authUser?.user_metadata?.state || "Nigeria",
    verified: true,
    stats: {
      orders: 24,
      favorites: 12,
      reviews: 8,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">My Profile</h1>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-lg p-6 text-white">
          <div className="flex items-start gap-4 mb-4">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-20 h-20 rounded-full border-4 border-white/20"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{user.name}</h2>
                {user.verified && (
                  <span className="text-white text-sm">✓</span>
                )}
              </div>
              <p className="text-white/90 text-sm mb-1">{user.email}</p>
              <p className="text-white/90 text-sm">{user.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/90">
            <MapPin className="w-4 h-4" />
            <span>{user.location}</span>
            <span>•</span>
            <span>Member since {user.memberSince}</span>
          </div>
          <Link
            to="/settings/profile/edit"
            className="mt-4 w-full py-2 bg-white text-[#22c55e] rounded-lg font-medium text-center flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Profile
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/orders" className="bg-white rounded-lg p-4 text-center">
            <Package className="w-6 h-6 text-[#22c55e] mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{user.stats.orders}</p>
            <p className="text-sm text-gray-600">Orders</p>
          </Link>
          <Link to="/favorites" className="bg-white rounded-lg p-4 text-center">
            <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{user.stats.favorites}</p>
            <p className="text-sm text-gray-600">Favorites</p>
          </Link>
          <Link to="/reviews" className="bg-white rounded-lg p-4 text-center">
            <Star className="w-6 h-6 text-[#eab308] mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{user.stats.reviews}</p>
            <p className="text-sm text-gray-600">Reviews</p>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg divide-y divide-gray-100">
          <Link to="/orders" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">My Orders</span>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
          <Link to="/favorites" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">Favorites</span>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
          <Link to="/messages" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <span className="font-medium text-gray-800">Messages</span>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
          <Link to="/settings" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <span className="font-medium text-gray-800">Settings</span>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* Seller Section */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Seller Account</h3>
          <p className="text-sm text-gray-600 mb-4">
            Start selling on GreenHub and earn money from items you no longer need
          </p>
          <div className="flex gap-2">
            <Link
              to="/seller/dashboard"
              className="flex-1 py-3 bg-[#22c55e] text-white rounded-lg font-semibold text-center hover:bg-[#16a34a] transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/seller/advertise"
              className="flex-1 py-3 bg-orange-100 text-orange-600 rounded-lg font-semibold text-center border border-orange-200 hover:bg-orange-200 transition-colors"
            >
              Boost Sales
            </Link>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">About</h3>
          <div className="space-y-2 text-sm">
            <Link to="/about" className="block text-gray-700 hover:text-[#22c55e]">
              About GreenHub
            </Link>
            <Link to="/terms" className="block text-gray-700 hover:text-[#22c55e]">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="block text-gray-700 hover:text-[#22c55e]">
              Privacy Policy
            </Link>
            <Link to="/help" className="block text-gray-700 hover:text-[#22c55e]">
              Help Center
            </Link>
          </div>
        </div>

        {/* Logout */}
        <button 
          onClick={async () => {
            await signOut();
            navigate('/login');
          }} 
          className="w-full py-3 bg-white text-red-600 rounded-lg font-semibold border border-red-200"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
