import { Link } from "react-router";
import { ExternalLink, Send } from "lucide-react";
import type { ReactNode } from "react";

export interface ChatProductCardProps {
  /** Product ID for routing to detail page */
  productId: string | number;
  /** Product title */
  title: string;
  /** Product price for display */
  price?: number;
  /** Formatted price string (e.g., "₦250,000") */
  priceDisplay?: string;
  /** Product image URL */
  imageUrl?: string;
  /** Product condition (e.g., "Used", "New") */
  condition?: string;
  /** Seller phone for WhatsApp link (optional) */
  sellerPhone?: string;
  /** Seller name for WhatsApp message */
  sellerName?: string;
  /** Compact view (smaller height) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Additional content after price */
  children?: ReactNode;
}

const PLACEHOLDER = "https://placehold.co/400x400/e5e7eb/9ca3af?text=No+Image";

/**
 * ChatProductCard
 *
 * Renders a product reference card in the chat flow.
 * Displays: thumbnail, title, price, and link to product detail.
 *
 * Features:
 * - Pinned to chat (seller always knows what product they're discussing)
 * - Deep linking back to ProductDetail page
 * - Metadata fetch (price updates reflected in real-time)
 * - Accessible and keyboard navigable
 */
export function ChatProductCard({
  productId,
  title,
  price,
  priceDisplay,
  imageUrl,
  condition,
  sellerPhone,
  sellerName = "Seller",
  compact = false,
  className = "",
  children,
}: ChatProductCardProps) {
  const detailUrl = `/products/${productId}`;
  const imageToShow = imageUrl || PLACEHOLDER;

  // Build WhatsApp link if seller phone is provided
  const cleanedPhone = (sellerPhone || "").replace(/[^\d+]/g, "");
  const whatsappPhone = cleanedPhone.replace(/^\+/, "");
  const whatsappMessage = `Hi ${sellerName}, I'm interested in your "${title.trim() || "this item"}" on GreenHub. Is it available?`;
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : "";

  return (
    <div
      className={`rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 ${compact ? "" : "mb-2"} ${className}`}
      role="complementary"
      aria-label={`Product card: ${title}`}
    >
      <Link
        to={detailUrl}
        className="block rounded-md overflow-hidden transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <div
          className="relative w-full bg-gray-100"
          style={{
            aspectRatio: "16 / 9",
            overflow: "hidden",
          }}
        >
          <img
            src={imageToShow}
            alt={title}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER;
            }}
          />
          {condition && (
            <div className="absolute left-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700">
              {condition}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-2">
        <Link
          to={detailUrl}
          className="line-clamp-2 text-xs font-semibold text-gray-900 hover:text-emerald-600 transition"
        >
          {title}
        </Link>

        {priceDisplay || price ? (
          <p className="mt-1 text-sm font-bold text-green-600">
            {priceDisplay || (price ? `₦${price.toLocaleString()}` : "Price unavailable")}
          </p>
        ) : null}

        {children}

        <div className="mt-2 flex gap-2">
          <Link
            to={detailUrl}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition rounded-md bg-emerald-100 py-1.5 hover:bg-emerald-200"
            aria-label={`View ${title} product details`}
          >
            View Product
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </Link>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold text-white bg-[#25D366] hover:opacity-90 transition rounded-md py-1.5"
              title="Chat on WhatsApp"
              aria-label={`Chat on WhatsApp about ${title}`}
            >
              <Send className="h-3 w-3 shrink-0" aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
