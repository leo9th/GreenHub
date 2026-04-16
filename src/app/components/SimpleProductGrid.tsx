import { ProductCard } from "./cards/ProductCard";

type ProductRow = Record<string, unknown>;

type SimpleProductGridProps = {
  products: ProductRow[];
  isLoading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

function SkeletonTile() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="aspect-[3/4] w-full animate-pulse bg-gray-200" />
      <div className="space-y-2 border-t border-gray-100 p-3">
        <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function SimpleProductGrid({
  products,
  isLoading,
  hasMore,
  loadingMore,
  onLoadMore,
}: SimpleProductGridProps) {
  if (!isLoading && products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
        No products found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full">
        {products.map((product) => {
          const profile = (product.profiles as Record<string, unknown> | null) ?? null;
          const sellerUsername =
            typeof profile?.username === "string"
              ? profile.username
              : typeof product.seller_username === "string"
                ? String(product.seller_username)
                : undefined;

          return (
            <ProductCard
              key={String(product.id)}
              id={String(product.id ?? "")}
              title={String(product.title ?? "")}
              price={Number(product.price ?? product.price_local ?? 0) || 0}
              image={typeof product.image === "string" ? product.image : ""}
              images={Array.isArray(product.images) ? (product.images as string[]) : undefined}
              location={typeof product.location === "string" ? product.location : ""}
              city={typeof product.city === "string" ? product.city : ""}
              state={typeof product.state === "string" ? product.state : ""}
              sellerName={typeof profile?.full_name === "string" ? profile.full_name : undefined}
              sellerUsername={sellerUsername}
            />
          );
        })}

        {isLoading
          ? Array.from({ length: 10 }).map((_, idx) => <SkeletonTile key={`skeleton-${idx}`} />)
          : null}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full border border-gray-200 bg-white px-8 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-500 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
