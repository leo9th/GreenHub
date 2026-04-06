import { Card, CardContent } from "../ui/card";

type Props = {
  count?: number;
  className?: string;
};

/** Placeholder tiles matching `ProductCard` layout while listings load. */
export function ProductCardSkeletonGrid({ count = 8, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="overflow-hidden h-full border-gray-100">
          <div className="relative aspect-[16/9] animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          <CardContent className="p-4 space-y-3">
            <div className="h-4 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
            <div className="h-6 w-1/2 rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-50 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
