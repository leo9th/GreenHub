import { useState } from "react";
import { Search, Send, ArrowLeft } from "lucide-react";
import { getAvatarUrl } from "../../../utils/getAvatar";

const conversations = [
  {
    id: 1,
    seller: "TechHub Store",
    avatar: null,
    lastMessage: "The item is still available. Would you like to proceed?",
    time: "10:30 AM",
    unread: 2,
    product: "iPhone 14 Pro Max",
  },
  {
    id: 2,
    seller: "ShoeLand",
    avatar: null,
    lastMessage: "Thank you for your purchase!",
    time: "Yesterday",
    unread: 0,
    product: "Nike Air Max",
  },
  {
    id: 3,
    seller: "ElectroMart",
    avatar: null,
    lastMessage: "Delivery scheduled for tomorrow",
    time: "2 days ago",
    unread: 1,
    product: "Samsung Smart TV",
  },
];

const messages = [
  {
    id: 1,
    sender: "buyer",
    text: "Hi, is this item still available?",
    time: "10:25 AM",
  },
  {
    id: 2,
    sender: "seller",
    text: "Yes, it's available. Would you like to know more about it?",
    time: "10:27 AM",
  },
  {
    id: 3,
    sender: "buyer",
    text: "What's the condition? Any defects?",
    time: "10:28 AM",
  },
  {
    id: 4,
    sender: "seller",
    text: "The item is still available. Would you like to proceed?",
    time: "10:30 AM",
  },
];

export function Messages() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");

  if (selectedConversation) {
    const conversation = conversations.find((c) => c.id === selectedConversation);

    return (
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)] bg-white">
        <div className="border-b border-border p-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedConversation(null)}
            className="text-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
            <img src={getAvatarUrl(conversation?.avatar, null, conversation?.seller)} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h2 className="text-foreground">{conversation?.seller}</h2>
            <p className="text-sm text-muted-foreground">{conversation?.product}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "buyer" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-3 ${
                  message.sender === "buyer"
                    ? "bg-[#22c55e] text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.sender === "buyer" ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  {message.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
            <button className="w-12 h-12 bg-[#22c55e] text-white rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="sticky top-0 bg-white border-b border-border p-4 z-10">
        <h1 className="text-xl text-foreground mb-3">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>
      </div>

      <div className="divide-y divide-border">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => setSelectedConversation(conversation.id)}
            className="w-full p-4 flex items-start gap-3 hover:bg-muted transition-colors"
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                <img src={getAvatarUrl(conversation.avatar, null, conversation.seller)} className="w-full h-full object-cover" />
              </div>
              {conversation.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {conversation.unread}
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-foreground">{conversation.seller}</h3>
                <span className="text-xs text-muted-foreground">{conversation.time}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{conversation.product}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {conversation.lastMessage}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
