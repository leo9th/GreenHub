import { MessageCircle } from "lucide-react";
import { Link } from "react-router";

/** Lightweight assistant entry — full bot lives in `FloatingChatbotWidget`. */
export function GreenBot() {
  return (
    <Link
      to="/messages"
      className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#15803d] text-white shadow-lg ring-2 ring-white hover:bg-[#166534] md:bottom-8"
      title="GreenBot — open messages"
      aria-label="Open GreenHub assistant and messages"
    >
      <MessageCircle className="h-6 w-6" />
    </Link>
  );
}
