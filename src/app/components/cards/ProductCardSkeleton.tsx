import { Card, CardContent } from "../ui/card";

type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching `ProductCard` layout while listings load. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>*]:min-h-0 ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <Card
          key={i}
          className="grid h-full min-h-0 aspect-[4/5] grid-rows-[minmax(0,4fr)_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm"
        >
          <div className="min-h-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          <CardContent className="flex min-h-0 flex-col justify-center gap-1.5 overflow-hidden px-2.5 py-1.5 sm:px-3 sm:py-2 [&:last-child]:pb-2">
            <div className="h-2.5 w-full rounded bg-gray-100 animate-pulse sm:h-3" />
            <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
            <div className="h-2 w-2/3 rounded bg-gray-50 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
