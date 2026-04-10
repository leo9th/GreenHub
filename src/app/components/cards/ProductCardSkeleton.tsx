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
          className="block h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="relative w-full bg-gray-100" style={{ paddingBottom: "100%" }}>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-white p-4">
            <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-200/80 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
