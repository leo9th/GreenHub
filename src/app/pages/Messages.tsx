import { Link, useNavigate } from "react-router";
import { ArrowLeft, Search, MessageCircle } from "lucide-react";
import { getAvatarUrl } from "../utils/getAvatar";

export default function Messages() {
  const navigate = useNavigate();

  const conversations = [
    {
      id: 1,
      user: {
        name: "Chidi Okonkwo",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", "male", "Chidi Okonkwo"),
      },
      product: {
        title: "iPhone 13 Pro Max 256GB",
        image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=100",
      },
      lastMessage: "Yes, it's still available. Would you like to see more pictures?",
      time: "10:30 AM",
      unread: 2,
      online: true,
    },
    {
      id: 2,
      user: {
        name: "Amina Yusuf",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", "female", "Amina Yusuf"),
      },
      product: {
        title: "Nike Air Max 270 Shoes",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100",
      },
      lastMessage: "Thanks for your purchase! I'll ship it today.",
      time: "Yesterday",
      unread: 0,
      online: false,
    },
    {
      id: 3,
      user: {
        name: "Tunde Adebayo",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", "male", "Tunde Adebayo"),
      },
      product: {
        title: "Sony WH-1000XM4 Headphones",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100",
      },
      lastMessage: "Can we meet at Ikeja City Mall?",
      time: "2 days ago",
      unread: 0,
      online: false,
    },
    {
      id: 4,
      user: {
        name: "Fatima Mohammed",
        avatar: getAvatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", "female", "Fatima Mohammed"),
      },
      product: {
        title: "Samsung Galaxy S21",
        image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=100",
      },
      lastMessage: "What's the battery health?",
      time: "3 days ago",
      unread: 1,
      online: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Messages</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      {/* Conversations List */}
      <div className="max-w-7xl mx-auto">
        {conversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No messages yet</h3>
            <p className="text-gray-600 text-sm mb-6">
              Start chatting with sellers about products you're interested in
            </p>
            <Link
              to="/products"
              className="inline-block px-6 py-3 bg-[#22c55e] text-white rounded-lg font-medium"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                to={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Avatar with online indicator */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conversation.user.avatar}
                    alt={conversation.user.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                  {conversation.online && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#22c55e] border-2 border-white rounded-full" />
                  )}
                  {conversation.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#ef4444] text-white text-xs rounded-full flex items-center justify-center font-semibold">
                      {conversation.unread}
                    </div>
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-800">{conversation.user.name}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {conversation.time}
                    </span>
                  </div>

                  {/* Product Context */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={conversation.product.image}
                        alt={conversation.product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">
                      {conversation.product.title}
                    </p>
                  </div>

                  {/* Last Message */}
                  <p className={`text-sm line-clamp-1 ${conversation.unread > 0 ? "font-medium text-gray-800" : "text-gray-600"}`}>
                    {conversation.lastMessage}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
