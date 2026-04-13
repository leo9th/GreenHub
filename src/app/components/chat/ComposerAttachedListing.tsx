import { Link } from "react-router";
import { X } from "lucide-react";

export type ComposerAttachedListingProps = {
  productId: number;
  title: string;
  priceLabel: string;
  imageUrl: string | null;
  onDismiss?: () => void;
};

/**
 * Compact listing preview above the chat composer (WhatsApp-style attachment strip).
 */
export function ComposerAttachedListing({
  productId,
  title,
  priceLabel,
  imageUrl,
  onDismiss,
}: ComposerAttachedListingProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#d1d7db] bg-white px-2 py-1.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/90">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-700">
        <img
          src={imageUrl || "https://placehold.co/80/png?text=Listing"}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-semibold text-gray-900 dark:text-zinc-100">{title}</p>
        <p className="text-[11px] font-bold text-[#25D366]">{priceLabel}</p>
      </div>
      <Link
        to={`/products/${productId}`}
        className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-zinc-700"
      >
        Open
      </Link>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700"
          aria-label="Hide listing from composer"
          title="Hide"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
