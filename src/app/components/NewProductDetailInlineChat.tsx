import { useMemo, useRef, useState } from "react";
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
import type { ProductPk } from "../utils/engagement";

const QUICK_REPLIES = [
  { label: "Make an offer", text: "Hi, I would like to make an offer on this item." },
  { label: "Is this available?", text: "Hi, is this item still available?" },
  { label: "Last price", text: "Hi, what is your last price for this item?" },
] as const;

type NewProductDetailInlineChatProps = {
  productId: ProductPk;
  sellerId: string;
  sellerName: string;
  sellerUsername?: string;
  sellerPhone?: string;
  sellerPhoneVerified?: boolean;
  sellerVerified: boolean;
  productTitle?: string;
  isOwner?: boolean;
  authUserId?: string;
};

export default function NewProductDetailInlineChat({
  productId,
  sellerId,
  sellerName,
  sellerUsername = "",
  sellerPhone,
  sellerPhoneVerified = false,
  sellerVerified,
  productTitle,
  isOwner = false,
  authUserId,
}: NewProductDetailInlineChatProps) {
  const [message, setMessage] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sellerPhoneRaw = useMemo(() => (sellerPhone != null ? String(sellerPhone).trim() : ""), [sellerPhone]);
  const cleanedPhone = useMemo(() => sellerPhoneRaw.replace(/[^\d+]/g, ""), [sellerPhoneRaw]);
  const sellerTelHref = cleanedPhone ? `tel:${cleanedPhone}` : "";
  const whatsappPhone = cleanedPhone.replace(/^\+/, "");
  const defaultWhatsAppText = `Hi ${sellerName}, I am interested in ${
    productTitle?.trim() || "this item"
  }. Is it still available?`;
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(defaultWhatsAppText)}`
    : "";

  const hasInternalChat = Boolean(authUserId) && !isOwner;

  const focusComposer = () => {
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast.message("Type your message below.");
  };

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

  if (isOwner) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-center text-sm text-gray-600">
        This is your listing — buyers will message you here.
      </div>
    );
  }

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
        {sellerUsername || sellerPhoneVerified ? (
          <span className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600">
            {sellerUsername ? `@${sellerUsername}` : null}
            {sellerPhoneVerified ? (
              <span className="text-green-600 text-xs" title="Phone verified">
                ✅
              </span>
            ) : null}
          </span>
        ) : null}
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
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        rows={3}
        className="mt-3 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:min-w-[9rem]"
        >
          {sending ? "Sending..." : "Send message"}
        </button>
        <CommunicationButton
          whatsappHref={whatsappHref}
          phoneNumber={sellerPhone}
          productTitle={productTitle || "this item"}
          hasInternalChat={hasInternalChat}
          onChatClick={focusComposer}
          className="min-h-[44px] min-w-0 flex-1 sm:min-w-[9rem]"
          disabled={sending}
        />
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 sm:min-w-[9rem]"
        >
          {showContact ? "Hide contact" : "Show contact"}
        </button>
      </div>

      {showContact && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm">
          {sellerTelHref ? (
            <>
              <p className="font-medium text-gray-900">Seller phone</p>
              <p className="mt-1 break-all font-mono text-gray-800">{sellerPhoneRaw}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={sellerTelHref}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Call
                </a>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-gray-600">Seller has not shared a phone number.</p>
          )}
        </div>
      )}
    </div>
  );
}
