import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Loader2, MessageCircle, Phone, ChevronDown, ChevronUp } from "lucide-react";
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
import { normalizeProductPk, productLikeSetKey } from "../utils/engagement";
import { VerifiedBadge } from "./VerifiedBadge";

const QUICK_MESSAGES = [
  { label: "Make an offer", text: "Hi, I would like to make an offer on this item." },
  { label: "Is this available?", text: "Hi, is this item still available?" },
  { label: "Last price", text: "Hi, what is your last price for this item?" },
] as const;

function formatYearsOnGreenHub(createdAt: string | null): string {
  if (!createdAt) return "New on GreenHub";
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return "Member on GreenHub";
  const ms = Date.now() - t;
  if (ms < 0) return "Member on GreenHub";
  const years = ms / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return "Less than 1 year on GreenHub";
  const y = Math.floor(years);
  return `${y}+ years on GreenHub`;
}

function replyEstimateLabel(online: boolean, lastActive: string | null): string {
  if (online) return "Typically replies within 30 minutes";
  if (lastActive) {
    const h = (Date.now() - new Date(lastActive).getTime()) / (60 * 60 * 1000);
    if (Number.isFinite(h) && h >= 0 && h < 48) return "Typically replies within a few hours";
  }
  return "Typically replies within a day";
}

export type ProductDetailInlineChatProps = {
  sellerId: string;
  sellerName: string;
  sellerCreatedAt: string | null;
  sellerVerified: boolean;
  sellerOnline: boolean;
  sellerLastActive: string | null;
  /** Raw `products.id` (number, string digits, UUID, bigint-serialized, etc.) */
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

  const listingPk = normalizeProductPk(productId);

  console.log("[Chat Debug] raw productId:", productId);
  console.log("[Chat Debug] normalized listingPk:", listingPk);

  const ensureConversation = useCallback(async (): Promise<ConversationRow | null> => {
    if (!authUserId) return null;
    if (authUserId === sellerId) return null;
    let conv = await findConversationByPair(supabase, authUserId, sellerId);
    if (conv) {
      if (listingPk != null) {
        const { error: uErr } = await setConversationContextProduct(supabase, conv.id, listingPk);
        if (!uErr) {
          conv = { ...conv, context_product_id: listingPk };
        }
      }
      return conv;
    }
    const { data: inserted, error: insErr } = await insertConversationPair(supabase, authUserId, sellerId, {
      contextProductId: listingPk ?? undefined,
    });
    if (insErr) {
      if (isDuplicateConversationError(insErr)) {
        const again = await findConversationByPair(supabase, authUserId, sellerId);
        if (again && listingPk != null) {
          await setConversationContextProduct(supabase, again.id, listingPk);
          return { ...again, context_product_id: listingPk };
        }
        return again;
      }
      throw new Error(insErr.message);
    }
    return inserted;
  }, [authUserId, sellerId, listingPk]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) {
      toast.message("Type a message or pick a quick reply.");
      return;
    }
    if (!authUserId) {
      toast.message("Log in to message the seller");
      navigate("/login");
      return;
    }
    if (isOwner) {
      toast.message("This is your listing.");
      return;
    }
    if (listingPk == null) {
      toast.error("This listing ID is invalid for chat.");
      return;
    }
    setSendBusy(true);
    try {
      const conv = await ensureConversation();
      if (!conv) {
        toast.error("Could not open conversation.");
        return;
      }

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conv.id,
          sender_id: authUserId,
          message: text,
          product_id: listingPk,
        })
        .select(CHAT_MESSAGE_BASE_COLUMNS)
        .single();

      if (error) throw new Error(error.message);

      setMessage("");
      toast.success("Message sent!", {
        description: "Your message was delivered.",
        action: {
          label: "Open chat",
          onClick: () =>
            navigate(`/messages/c/${conv.id}?product=${encodeURIComponent(productLikeSetKey(listingPk))}`),
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Message not sent";
      toast.error(msg);
    } finally {
      setSendBusy(false);
    }
  };

  if (isOwner) {
    return (
      <div className="rounded-xl bg-gray-50 px-3 py-3 text-center text-sm text-gray-600 ring-1 ring-gray-100">
        This is your listing — buyers will message you here.
      </div>
    );
  }

  if (!sellerId) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white px-3 py-4 ring-1 ring-emerald-100/80 sm:px-4">
      <div className="border-b border-emerald-100/80 pb-3">
        <p className="text-base font-semibold text-gray-900">{sellerName}</p>
        <p className="mt-1 text-xs text-gray-600">{formatYearsOnGreenHub(sellerCreatedAt)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sellerVerified ? <VerifiedBadge title="Verified seller" size="sm" /> : null}
          <span className="text-xs text-gray-500">{replyEstimateLabel(sellerOnline, sellerLastActive)}</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Quick replies</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_MESSAGES.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setMessage(q.text)}
            className="rounded-full border border-emerald-200/80 bg-white px-3 py-1.5 text-xs font-medium text-[#15803d] transition hover:bg-emerald-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message…"
          rows={3}
          className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#15803d]/20"
        />
      </label>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <button
          type="button"
          disabled={sendBusy}
          onClick={() => void sendMessage()}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803d] disabled:opacity-60"
        >
          {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />}
          Start chat
        </button>
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          Show contact
          {showContact ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <span aria-hidden>💬</span>
          Chat on WhatsApp
        </a>
      ) : null}

      {showContact ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-3 text-sm">
          {sellerTelHref ? (
            <>
              <p className="font-medium text-gray-900">Seller phone</p>
              <p className="mt-1 break-all font-mono text-gray-800">{sellerTelHref.replace(/^tel:/, "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={sellerTelHref}
                  className="inline-flex flex-1 min-w-[7rem] items-center justify-center rounded-lg bg-[#15803d] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#166534]"
                >
                  Call
                </a>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 min-w-[7rem] items-center justify-center rounded-lg bg-[#25D366] px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-gray-600">This seller hasn&apos;t shared a phone number on GreenHub yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
