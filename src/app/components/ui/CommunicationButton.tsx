import { MessageCircle } from "lucide-react";

export interface CommunicationButtonProps {
  /** WhatsApp href link (if available) */
  whatsappHref?: string;
  /** Product title for pre-filled message */
  productTitle: string;
  /** Whether internal chat is available (user is logged in and not owner) */
  hasInternalChat?: boolean;
  /** Callback when internal chat button is clicked */
  onChatClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether button is in disabled/loading state */
  disabled?: boolean;
}

/**
 * Unified Communication Button Component
 *
 * Smart Logic:
 * 1. If WhatsApp is available → Green WhatsApp button with pre-filled message
 * 2. If WhatsApp unavailable but internal chat available → Blue "Send Message" button
 * 3. If neither available → Gray "Unavailable" button
 *
 * This ensures:
 * - Zero layout shift (button always occupies space)
 * - No dead ends (always provides a path forward)
 * - Professional UX (pre-filled messages with product context)
 */
export function CommunicationButton({
  whatsappHref,
  productTitle,
  hasInternalChat = true,
  onChatClick,
  className = "",
  disabled = false,
}: CommunicationButtonProps) {
  const isWhatsAppAvailable = !!whatsappHref && whatsappHref.trim() !== "";

  // WhatsApp button
  if (isWhatsAppAvailable) {
    return (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 ${className}`}
        aria-label={`Chat on WhatsApp about ${productTitle}`}
      >
        <span aria-hidden>💬</span>
        <span>WhatsApp</span>
      </a>
    );
  }

  // Internal Chat button
  if (hasInternalChat && !disabled) {
    return (
      <button
        type="button"
        onClick={onChatClick}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60 ${className}`}
        aria-label={`Send message about ${productTitle}`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>Send Message</span>
      </button>
    );
  }

  // Unavailable state (gray button)
  return (
    <span
      className={`inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-gray-500 ${className}`}
      title="Seller has no contact methods available"
      role="status"
      aria-label="Contact method unavailable"
    >
      Unavailable
    </span>
  );
}
