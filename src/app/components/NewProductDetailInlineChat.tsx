import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { CommunicationButton } from "./ui/CommunicationButton";
import {
  findConversationByPair,
  insertConversationPair,
  isDuplicateConversationError,
  setConversationContextProduct,
  type ConversationRow,
} from "../utils/chatConversations";
import { CHAT_MESSAGE_BASE_COLUMNS } from "../utils/chatMessages";

const QUICK_REPLIES = [
  { label: "Make an offer", text: "Hi, I would like to make an offer on this item." },
  { label: "Is this available?", text: "Hi, is this item still available?" },
  { label: "Last price", text: "Hi, what is your last price for this item?" },
] as const;

type NewProductDetailInlineChatProps = {
  productId: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerVerified: boolean;
  productTitle?: string;
};

export default function NewProductDetailInlineChat({
  productId,
  sellerId,
  sellerName,
  sellerPhone,
  sellerVerified,
  productTitle,
}: NewProductDetailInlineChatProps) {
  const [message, setMessage] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [sending, setSending] = useState(false);

  const cleanedPhone = useMemo(() => (sellerPhone || "").replace(/[^\d+]/g, ""), [sellerPhone]);
  const telHref = cleanedPhone ? `tel:${cleanedPhone}` : "";
  const whatsappPhone = cleanedPhone.replace(/^\+/, "");
  const defaultWhatsAppText = `Hi ${sellerName}, I am interested in ${
    productTitle?.trim() || "this item"
  }. Is it still available?`;
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(defaultWhatsAppText)}`
    : "";

  const ensureConversation = async (): Promise<ConversationRow | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw new Error("Please log in to send a message.");
    if (userId === sellerId) throw new Error("You cannot message yourself.");

    const existing = await findConversationByPair(supabase, userId, sellerId);
    if (existing) {
      await setConversationContextProduct(supabase, existing.id, productId);
      return { ...existing, context_product_id: productId };
    }

    const { data: inserted, error } = await insertConversationPair(supabase, userId, sellerId, {
      contextProductId: productId,
    });
    if (error) {
      if (isDuplicateConversationError(error)) {
        const again = await findConversationByPair(supabase, userId, sellerId);
        if (again) {
          await setConversationContextProduct(supabase, again.id, productId);
          return { ...again, context_product_id: productId };
        }
      }
      throw new Error(error.message);
    }
    return inserted;
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      toast.message("Type a message or choose a quick reply.");
      return;
    }

    setSending(true);
    try {
      const conversation = await ensureConversation();
      if (!conversation) throw new Error("Failed to create conversation.");

      const { data: auth } = await supabase.auth.getUser();
      const senderId = auth.user?.id;
      if (!senderId) throw new Error("Please log in to send a message.");

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: senderId,
          message: text,
          product_id: productId,
        })
        .select(CHAT_MESSAGE_BASE_COLUMNS)
        .single();
      if (error) throw new Error(error.message);

      setMessage("");
      toast.success("Message sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-gray-900">{sellerName}</p>
          {sellerVerified ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
              ✓
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500">Typically replies within 30 minutes</p>
      </div>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick replies</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply.label}
            type="button"
            onClick={() => setMessage(reply.text)}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {reply.label}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        rows={3}
        className="mt-3 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send message"}
        </button>
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          {showContact ? "Hide contact" : "Show contact"}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <CommunicationButton
          whatsappHref={whatsappHref}
          productTitle={productTitle || "this item"}
          hasInternalChat={true}
          onChatClick={() => void handleSend()}
          className="flex-1 min-h-[40px]"
          disabled={sending}
        />
      </div>

      {showContact ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {cleanedPhone ? (
            <>
              <p className="text-sm font-medium text-gray-900">{cleanedPhone}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={telHref}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Call
                </a>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">Seller phone not available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
