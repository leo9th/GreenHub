type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching ProductCard: 3:4, 75/25, shimmer image + 3 text bars. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`product-card-skeleton-grid grid w-full [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] gap-4 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="product-card flex aspect-[3/4] w-full min-w-[160px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card"
        >
          <div
            className="product-card-skeleton__image shrink-0"
            style={{
              height: "75%",
              width: "100%",
              overflow: "hidden",
              backgroundColor: "#e5e7eb",
            }}
          />
          <div
            className="flex min-h-0 flex-1 flex-col justify-center border-t border-gray-100 bg-white dark:border-border dark:bg-card"
            style={{ padding: "8px 12px", gap: "6px", maxHeight: "25%" }}
          >
            <div className="h-3.5 w-full animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-emerald-100 dark:bg-emerald-900/40" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-zinc-600/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
