type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching ProductCard: fixed image height, auto text + shimmer. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`product-card-skeleton-grid grid w-full [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] gap-4 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="product-card w-full min-w-[160px] rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card"
        >
          <div className="product-card-skeleton__image h-[clamp(200px,52vw,280px)] min-h-[200px] w-full shrink-0 overflow-hidden rounded-t-xl" />
          <div
            className="flex flex-col gap-1 border-t border-gray-100 bg-white dark:border-border dark:bg-card"
            style={{ padding: "10px 12px" }}
          >
            <div className="h-3.5 w-full animate-pulse rounded bg-gray-200 dark:bg-zinc-600" />
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-emerald-100 dark:bg-emerald-900/40" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-zinc-600/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
