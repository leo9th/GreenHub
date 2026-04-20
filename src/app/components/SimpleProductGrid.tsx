import { memo } from "react";
import { ProductCard } from "./cards/ProductCard";
import type { ProductWithSeller } from "../types/productWithSeller";

const GRID_CLASS =
  "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full";

type SimpleProductGridProps = {
  products: ProductWithSeller[];
  isLoading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Shown below “No products found.” when the main list is empty (not loading). */
  emptyFallbackTitle?: string;
  emptyFallbackProducts?: ProductWithSeller[];
  emptyFallbackLoading?: boolean;
  /** After fallback fetch completes with zero rows (optional short message). */
  emptyFallbackExhaustedHint?: boolean;
};

function SkeletonTile() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="product-card-skeleton__image aspect-[3/4] w-full bg-gray-200" />
      <div className="space-y-2 border-t border-gray-100 p-3">
        <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

const ProductCardFromProduct = memo(function ProductCardFromProduct({
  product,
  index,
}: {
  product: ProductWithSeller;
  index: number;
}) {
  const seller = product.seller;
  const legacyProfile = product.profiles as { full_name?: string } | null | undefined;
  const sellerName =
    seller && typeof seller.full_name === "string" && seller.full_name.trim() !== ""
      ? seller.full_name.trim()
      : legacyProfile && typeof legacyProfile.full_name === "string" && legacyProfile.full_name.trim() !== ""
        ? legacyProfile.full_name.trim()
        : undefined;
  const sellerVerified = seller?.phone_verified === true;

  return (
    <ProductCard
      id={String(product.id ?? "")}
      title={String(product.title ?? "")}
      price={Number(product.price_local ?? product.price ?? 0) || 0}
      priceLocal={Number(product.price_local ?? 0) || undefined}
      image={typeof product.image === "string" ? product.image : ""}
      images={Array.isArray(product.images) ? (product.images as string[]) : undefined}
      location={typeof product.location === "string" ? product.location : ""}
      city={typeof product.city === "string" ? product.city : ""}
      condition={typeof product.condition === "string" ? product.condition : ""}
      sellerName={sellerName}
      sellerVerified={sellerVerified}
      imagePriority={index < 6}
    />
  );
});

export default function SimpleProductGrid({
  products,
  isLoading,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyFallbackTitle = "Recommended for you",
  emptyFallbackProducts,
  emptyFallbackLoading,
  emptyFallbackExhaustedHint,
}: SimpleProductGridProps) {
  if (!isLoading && products.length === 0) {
    const showFallbackBlock =
      emptyFallbackLoading === true ||
      (Array.isArray(emptyFallbackProducts) && emptyFallbackProducts.length > 0);

    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No products found.
        </div>

        {showFallbackBlock ? (
          <section className="space-y-4" aria-label={emptyFallbackTitle}>
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{emptyFallbackTitle}</h2>
            {emptyFallbackLoading ? (
              <div className={GRID_CLASS}>
                {Array.from({ length: 10 }).map((_, idx) => (
                  <SkeletonTile key={`empty-fallback-sk-${idx}`} />
                ))}
              </div>
            ) : (
              <div className={GRID_CLASS}>
                {(emptyFallbackProducts ?? []).map((product, index) => (
                  <ProductCardFromProduct key={String(product.id)} product={product} index={index} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {emptyFallbackExhaustedHint ? (
          <p className="text-center text-sm text-gray-500">Check back later for new listings.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className={GRID_CLASS}>
        {products.map((product, index) => (
          <ProductCardFromProduct key={String(product.id)} product={product} index={index} />
        ))}

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
            className="w-full max-w-sm rounded-full border-2 border-slate-200 bg-white px-8 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
