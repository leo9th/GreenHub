type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching `ProductCard` layout while listings load. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="grid h-full w-full min-h-0 min-w-0 aspect-[4/5] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm"
        >
          <div className="min-h-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          <div className="w-full shrink-0 border-t border-gray-200 bg-white px-4 py-6">
            <div className="space-y-4">
              <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-200/80 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
