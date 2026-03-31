import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, Maximize2, Minimize2 } from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
};

const FAQ_RESPONSES: Record<string, string> = {
  "hello": "Hi there! Welcome to GreenHub. How can I assist you today?",
  "hi": "Hello! How can I help you navigate GreenHub today?",
  "sell": "To sell an item, you need to create an account, take clear photos of your item, click the big 'Sell' button, and fill out the details. Can I help you with anything else about selling?",
  "buy": "To buy an item on GreenHub, simply search for what you need, review the seller's profile, and click contact to message them. Always meet in a public place!",
  "contact": "You can reach our support team via email at support@greenhub.ng or WhatsApp at +234 812 522 1542.",
  "support": "You can easily reach us via email at support@greenhub.ng or contact us via WhatsApp/Tel at +234 812 522 1542.",
  "account": "You can manage your account settings by clicking on the 'Profile' icon in the navigation bar. You need to verify your phone number to sell.",
  "shipping": "Shipping costs depend on the seller and your location. You can view estimated delivery fees on the checkout page before confirming payment.",
  "delivery": "Delivery is handled directly by sellers. Be sure to agree on delivery terms or a safe meeting spot before making any payments.",
  "scam": "Your safety is our priority. Never pay in advance! Always inspect items in person at a public location before handing over money.",
  "payment": "We support Card, Bank Transfer, USSD, and Pay on Delivery. For your safety, we strongly recommend Pay on Delivery after inspecting the item.",
  "return": "Returns are subject to the individual seller's policy. Always clarify return conditions with the seller via chat before purchasing.",
  "register": "Click on the 'Profile' icon at the bottom, then select 'Register' to create a new account using your email and phone number.",
  "login": "Click the 'Profile' icon at the bottom to log into your existing account.",
  "store": "You can set up a GreenHub store by navigating to your Seller Dashboard and adding your business details.",
  "default": "I'm still learning, but I'm here to help! Could you please try asking your question differently or contact our support team at support@greenhub.ng?",
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial Greeting
  useEffect(() => {
    const now = new Date();
    setMessages([
      {
        id: "initial-msg",
        sender: "ai",
        text: "Hi there! I am the GreenHub Support Assistant. You can ask me how to 'sell', how to 'buy', or how to 'contact' support!",
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    const now = new Date();
    
    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: "user",
        text: userMsg,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    
    setInputText("");
    setIsTyping(true);

    // Process AI Response
    setTimeout(() => {
      const lowerInput = userMsg.toLowerCase();
      let responseText = FAQ_RESPONSES["default"];

      for (const key in FAQ_RESPONSES) {
        if (lowerInput.includes(key) && key !== "default") {
          responseText = FAQ_RESPONSES[key];
          break;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: "ai",
          text: responseText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      setIsTyping(false);
    }, 1000); // simulate thinking
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 bg-[#22c55e] border-2 border-white text-white p-4 rounded-full shadow-2xl hover:bg-[#16a34a] hover:scale-105 transition-all z-[60] flex items-center justify-center animate-bounce duration-1000"
      >
        <MessageSquare className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-[6px] py-[2px] rounded-full border border-white shrink-0">
          1
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed right-6 bottom-24 bg-white shrink-0 shadow-2xl z-[60] transition-all duration-300 flex flex-col overflow-hidden border border-gray-200 ${isMinimized ? 'w-80 h-14 rounded-xl' : 'w-[350px] md:w-[400px] h-[500px] max-h-[80vh] rounded-2xl'}`}>
      
      {/* Header */}
      <div 
        className="bg-[#22c55e] px-4 py-3 flex items-center justify-between text-white cursor-pointer shrink-0"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">GreenHub Support</h3>
            {!isMinimized && <p className="text-[10px] text-green-100">Usually replies instantly</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="p-1 hover:bg-white/20 rounded"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button 
            className="p-1 hover:bg-white/20 rounded"
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div 
          ref={scrollRef}
          className="flex-1 bg-gray-50 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((msg) => {
            const isAI = msg.sender === "ai";
            return (
              <div key={msg.id} className={`flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isAI ? 'justify-start' : 'justify-end'}`}>
                {isAI && (
                  <div className="shrink-0 mt-1">
                    <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center text-white">
                      <Bot className="w-3 h-3" />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-[80%] p-3 shadow-sm ${isAI ? 'bg-white border border-gray-100 rounded-2xl rounded-tl-none text-gray-700' : 'bg-[#22c55e] border border-[#16a34a] rounded-2xl rounded-tr-none text-white'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <span className={`text-[9px] block text-right mt-1 ${isAI ? 'text-gray-400' : 'text-green-100'}`}>{msg.time}</span>
                </div>
              </div>
            );
          })}

          {isTyping && (
             <div className="flex gap-2 justify-start animate-in fade-in duration-300">
                <div className="shrink-0 mt-1">
                  <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center text-white">
                    <Bot className="w-3 h-3" />
                  </div>
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
             </div>
          )}
        </div>
      )}

      {/* Input Area */}
      {!isMinimized && (
        <div className="bg-white border-t border-gray-100 p-3 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-100 text-sm px-4 py-2.5 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-[#22c55e]/50"
            />
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="bg-[#22c55e] text-white p-2.5 rounded-full hover:bg-[#16a34a] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
