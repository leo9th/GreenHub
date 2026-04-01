import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon, Phone, Video } from "lucide-react";
import { getAvatarUrl } from "../utils/getAvatar";

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = {
    user: {
      id: 1,
      name: "Chidi Okonkwo",
      avatar: getAvatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", "male", "Chidi Okonkwo"),
      online: false,
      lastActive: "2 hours ago",
    },
    product: {
      id: 1,
      title: "iPhone 13 Pro Max 256GB",
      price: 450000,
      image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=100",
    },
  };

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "them",
      text: "Hello! Thanks for your interest in my iPhone 13 Pro Max.",
      time: "10:15 AM",
      read: true,
    },
    {
      id: 2,
      sender: "me",
      text: "Hi! Is it still available?",
      time: "10:20 AM",
      read: true,
    },
    {
      id: 3,
      sender: "them",
      text: "Yes, it's still available. Would you like to see more pictures?",
      time: "10:30 AM",
      read: true,
    },
    {
      id: 4,
      sender: "me",
      text: "Yes please! And what's the battery health?",
      time: "10:32 AM",
      read: true,
    },
    {
      id: 5,
      sender: "them",
      text: "Battery health is at 98%. I'll send you more photos now.",
      time: "10:35 AM",
      read: true,
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      sender: "me",
      text: message,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage("");

    // Simulate typing indicator and Auto-reply if seller is offline
    if (!conversation.user.online) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          sender: "them",
          text: "[Auto-Reply]: I am currently away or busy. I will get back to you within 24 hours. Thanks!",
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          read: true,
        }]);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="relative flex-shrink-0">
              <img
                src={conversation.user.avatar}
                alt={conversation.user.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              {conversation.user.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] border-2 border-white rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-800">{conversation.user.name}</h1>
              <p className="text-xs text-gray-600">
                {conversation.user.online ? "Online" : `Last active ${conversation.user.lastActive}`}
              </p>
            </div>
            <button className="p-2">
              <Phone className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Product Context */}
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
              <img
                src={conversation.product.image}
                alt={conversation.product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 line-clamp-1">{conversation.product.title}</p>
              <p className="text-sm font-semibold text-gray-800">₦{conversation.product.price.toLocaleString()}</p>
            </div>
            <button
              onClick={() => navigate(`/products/${conversation.product.id}`)}
              className="text-xs text-[#22c55e] font-medium flex-shrink-0"
            >
              View
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-7xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.sender === "me"
                    ? "bg-[#22c55e] text-white rounded-br-sm"
                    : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span
                    className={`text-xs ${
                      msg.sender === "me" ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    {msg.time}
                  </span>
                  {msg.sender === "me" && (
                    <span className="text-xs text-white/80">
                      {msg.read ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-end gap-2">
            <button className="p-2 text-gray-600">
              <ImageIcon className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="p-2 bg-[#22c55e] rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
