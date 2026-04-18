import { MessageCircle } from "lucide-react";

export interface CommunicationButtonProps {
  /** Full WhatsApp URL when already built (takes precedence). */
  whatsappHref?: string;
  /** Raw digits; used to build `wa.me` when `whatsappHref` is empty. */
  phoneNumber?: string;
  productTitle: string;
  /** Whether the blue “Send Message” (internal chat) path is available. */
  hasInternalChat?: boolean;
  onChatClick?: () => void;
  className?: string;
  disabled?: boolean;
}

function buildWhatsAppHrefFromPhone(phoneNumber: string | undefined, productTitle: string): string {
  const clean = String(phoneNumber ?? "").replace(/\D/g, "");
  if (!clean) return "";
  const msg = encodeURIComponent(
    `Hi, I'm interested in your "${productTitle.trim() || "this item"}" on GreenHub!`,
  );
  return `https://wa.me/${clean}?text=${msg}`;
}

/**
 * Unified buyer–seller action: WhatsApp when a number exists, otherwise internal chat, else disabled.
 */
export function CommunicationButton({
  whatsappHref,
  phoneNumber,
  productTitle,
  hasInternalChat = true,
  onChatClick,
  className = "",
  disabled = false,
}: CommunicationButtonProps) {
  const resolvedHref =
    (typeof whatsappHref === "string" && whatsappHref.trim() !== ""
      ? whatsappHref.trim()
      : buildWhatsAppHrefFromPhone(phoneNumber, productTitle)) || "";

  const isWhatsAppAvailable = resolvedHref.length > 0;

  if (isWhatsAppAvailable) {
    return (
      <a
        href={resolvedHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex flex-1 min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
        aria-label={`Chat on WhatsApp about ${productTitle}`}
        aria-disabled={disabled || undefined}
      >
        <span aria-hidden>💬</span>
        <span>WhatsApp</span>
      </a>
    );
  }

  if (hasInternalChat) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onChatClick}
        className={`inline-flex flex-1 min-h-[40px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        aria-label={`Send message about ${productTitle}`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>Send Message</span>
      </button>
    );
  }

  return (
    <span
      className={`inline-flex flex-1 min-h-[40px] cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-gray-500 ${className}`}
      title="Seller has no contact methods available"
      role="status"
      aria-label="Contact method unavailable"
    >
      Unavailable
    </span>
  );
}
