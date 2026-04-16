import { ProductCard } from "./cards/ProductCard";
import { ProductCardSkeletonGrid } from "./cards/ProductCardSkeleton";
import { getProductThumbnailUrl, parseProductImagesFromRow } from "../utils/productImages";

type ProductRow = Record<string, unknown>;

type ProductGridProps = {
  products: ProductRow[];
  loading: boolean;
};

export default function ProductGrid({ products, loading }: ProductGridProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white/50 p-3">
        <ProductCardSkeletonGrid count={10} />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-600 py-8 text-center rounded-xl border border-dashed border-gray-200 bg-white">
        No products found yet. Listings with status &quot;active&quot; will appear here.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white/50 p-3">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:w-full">
        {products.map((product) => {
          const pid = Number(product.id);
          const sid = product.seller_id != null ? String(product.seller_id) : "";
          return (
            <ProductCard
              key={String(product.id)}
              href={`/products/${product.id}`}
              image={getProductThumbnailUrl(product)}
              images={parseProductImagesFromRow(product as { image?: unknown; images?: unknown })}
              title={String(product.title ?? "")}
              price={Number(product.price) || 0}
              location={String(product.location ?? "")}
              city={String(product.city ?? "")}
              state={String(product.state ?? "")}
              productId={Number.isFinite(pid) ? pid : String(product.id ?? "")}
              sellerName={sid ? String(product.seller_name ?? "") : undefined}
              sellerUsername={sid ? String(product.seller_username ?? "") : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
