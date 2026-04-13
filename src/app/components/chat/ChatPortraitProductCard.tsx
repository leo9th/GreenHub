import { Link } from "react-router";
import type { ReactNode } from "react";

type ChatPortraitProductCardProps = {
  productId: number;
  title: string;
  priceLabel: string;
  imageUrl: string | null;
  /** Shown on image (e.g. condition) */
  badge?: ReactNode;
  /** When true, shows the tile without navigation (e.g. multi-select mode). */
  disableLink?: boolean;
};

/**
 * Narrow portrait listing tile (Temu-style): tall image, bold orange price, compact title.
 */
export function ChatPortraitProductCard({
  productId,
  title,
  priceLabel,
  imageUrl,
  badge,
  disableLink,
}: ChatPortraitProductCardProps) {
  const shellClass =
    "mt-1.5 flex w-[7.75rem] cursor-pointer flex-col overflow-hidden rounded-xl border border-orange-100/90 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] transition hover:border-orange-200 hover:shadow-md sm:w-[8.5rem]";

  const inner = (
    <>
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[#f3f4f6]">
        <img
          src={imageUrl || "https://placehold.co/300x400/png?text=No+image"}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {badge ? (
          <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[2px]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 bg-white px-2 py-1.5">
        <p className="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-snug text-[#222]">{title}</p>
        <p className="text-[13px] font-extrabold leading-tight tracking-tight text-[#fb7701]">{priceLabel}</p>
      </div>
    </>
  );

  if (disableLink) {
    return (
      <div className={shellClass} aria-label={`Listing: ${title}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={`/products/${productId}`}
      className={shellClass}
      aria-label={`Open listing: ${title}`}
    >
      {inner}
    </Link>
  );
}
