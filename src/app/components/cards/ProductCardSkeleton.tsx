type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching `ProductCard` layout while listings load. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="product-card grid aspect-[4/5] w-full min-w-[140px] grid-rows-[minmax(0,3fr)_minmax(0,1fr)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
        >
          <div className="product-image min-h-0 w-full bg-gray-100 dark:bg-muted">
            <div className="h-full min-h-[4rem] w-full animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
          </div>
          <div className="product-details flex min-h-0 flex-col gap-2 border-t border-gray-100 bg-white p-2 dark:border-border dark:bg-card">
            <div className="h-3.5 w-full rounded bg-gray-100 dark:bg-zinc-700 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-zinc-700 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-200/80 dark:bg-zinc-600/80 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
