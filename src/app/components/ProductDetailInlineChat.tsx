import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  findConversationByPair,
  insertConversationPair,
  isDuplicateConversationError,
  setConversationContextProduct,
  type ConversationRow,
} from "../utils/chatConversations";
import { CHAT_MESSAGE_BASE_COLUMNS } from "../utils/chatMessages";
import { VerifiedBadge } from "./VerifiedBadge";

const QUICK_MESSAGES = [
  { label: "Make an offer", text: "Hi, I would like to make an offer on this item." },
  { label: "Is this available?", text: "Hi, is this item still available?" },
  { label: "Last price", text: "Hi, what is your last price for this item?" },
] as const;

function formatYearsOnGreenHub(createdAt: string | null): string {
  if (!createdAt) return "New on GreenHub";
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return "Member on GreenHub";
  const years = (Date.now() - createdMs) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return "Less than 1 year on GreenHub";
  return `${Math.floor(years)}+ years on GreenHub`;
}

function replyEstimateLabel(online: boolean, lastActive: string | null): string {
  if (online) return "Typically replies within 30 minutes";
  if (!lastActive) return "Typically replies within a day";
  const hours = (Date.now() - new Date(lastActive).getTime()) / (60 * 60 * 1000);
  if (Number.isFinite(hours) && hours >= 0 && hours < 48) return "Typically replies within a few hours";
  return "Typically replies within a day";
}

export type ProductDetailInlineChatProps = {
  sellerId: string;
  sellerName: string;
  sellerCreatedAt: string | null;
  sellerVerified: boolean;
  sellerOnline: boolean;
  sellerLastActive: string | null;
  productId: string | number | null | undefined;
  authUserId: string | undefined;
  isOwner: boolean;
  sellerTelHref: string;
  whatsappHref: string;
};

export function ProductDetailInlineChat({
  sellerId,
  sellerName,
  sellerCreatedAt,
  sellerVerified,
  sellerOnline,
  sellerLastActive,
  productId,
  authUserId,
  isOwner,
  sellerTelHref,
  whatsappHref,
}: ProductDetailInlineChatProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  // Keep product id exactly as supplied by parent; no normalization.
  const listingProductId = useMemo(() => {
    const value = productId == null ? "" : String(productId).trim();
    return value || null;
  }, [productId]);

  const ensureConversation = useCallback(async (): Promise<ConversationRow | null> => {
    if (!authUserId || !sellerId || authUserId === sellerId) return null;

    let conv = await findConversationByPair(supabase, authUserId, sellerId);
    if (conv) {
      if (listingProductId) {
        await setConversationContextProduct(supabase, conv.id, listingProductId);
        conv = { ...conv, context_product_id: listingProductId };
      }
      return conv;
    }

    const { data: inserted, error: insertError } = await insertConversationPair(supabase, authUserId, sellerId, {
      contextProductId: listingProductId ?? undefined,
    });

    if (insertError) {
      if (isDuplicateConversationError(insertError)) {
        const existing = await findConversationByPair(supabase, authUserId, sellerId);
        if (existing && listingProductId) {
          await setConversationContextProduct(supabase, existing.id, listingProductId);
          return { ...existing, context_product_id: listingProductId };
        }
        return existing;
      }
      throw new Error(insertError.message);
    }

    return inserted;
  }, [authUserId, sellerId, listingProductId]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) {
      toast.message("Type a message or choose a quick reply.");
      return;
    }
    if (!authUserId) {
      toast.message("Log in to message the seller.");
      navigate("/login");
      return;
    }
    if (isOwner) {
      toast.message("This is your listing.");
      return;
    }

    setSendBusy(true);
    try {
      const conv = await ensureConversation();
      if (!conv) {
        toast.error("Could not open conversation.");
        return;
      }

      const payload: Record<string, unknown> = {
        conversation_id: conv.id,
        sender_id: authUserId,
        message: text,
      };
      if (listingProductId) payload.product_id = listingProductId;

      const { error } = await supabase.from("chat_messages").insert(payload).select(CHAT_MESSAGE_BASE_COLUMNS).single();
      if (error) throw new Error(error.message);

      setMessage("");
      toast.success("Message sent!", {
        action: {
          label: "Open chat",
          onClick: () => navigate(`/messages/c/${conv.id}`),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Message not sent";
      toast.error(msg);
    } finally {
      setSendBusy(false);
    }
  };

  if (isOwner) {
    return (
      <div className="rounded-xl bg-gray-50 px-3 py-3 text-center text-sm text-gray-600 ring-1 ring-gray-100">
        This is your listing - buyers will message you here.
      </div>
    );
  }

  if (!sellerId) return null;

  return (
    <div className="rounded-xl border border-emerald-100 bg-white px-3 py-4 ring-1 ring-emerald-100 sm:px-4">
      <div className="border-b border-gray-100 pb-3">
        <p className="text-base font-semibold text-gray-900">{sellerName}</p>
        <p className="mt-1 text-xs text-gray-600">{formatYearsOnGreenHub(sellerCreatedAt)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sellerVerified ? <VerifiedBadge title="Verified seller" size="sm" /> : null}
          <span className="text-xs text-gray-500">{replyEstimateLabel(sellerOnline, sellerLastActive)}</span>
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick replies</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_MESSAGES.map((quick) => (
          <button
            key={quick.label}
            type="button"
            onClick={() => setMessage(quick.text)}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            {quick.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          rows={3}
          className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
      </label>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={sendBusy}
          onClick={() => void sendMessage()}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sendBusy ? "Sending..." : "Start chat"}
        </button>
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          {showContact ? "Hide contact" : "Show contact"}
        </button>
      </div>

      {showContact ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm">
          {sellerTelHref ? (
            <>
              <p className="font-medium text-gray-900">Seller phone</p>
              <p className="mt-1 break-all font-mono text-gray-800">{sellerTelHref.replace(/^tel:/, "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={sellerTelHref}
                  className="inline-flex min-w-[7rem] flex-1 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Call
                </a>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-[7rem] flex-1 items-center justify-center rounded-lg bg-[#25D366] px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-gray-600">This seller has not shared a phone number yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
