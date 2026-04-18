import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import { categoryFilterLabelToDbValue } from "../data/catalogConstants";
import SimpleProductGrid from "../components/SimpleProductGrid";
import type { ProductWithSeller } from "../types/productWithSeller";

const LIMIT = 12;

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterSelection>("All");
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    if (selectedCategory === "All") return "All Categories";
    return selectedCategory;
  }, [selectedCategory]);

  const fetchProducts = async (isNewCategory = false) => {
    const currentPage = isNewCategory ? 0 : page;
    const from = currentPage * LIMIT;
    const to = from + LIMIT - 1;

    if (isNewCategory) {
      setIsLoading(true);
      setProducts([]);
    } else {
      setLoadingMore(true);
    }

    setError(null);

    let query = supabase
      .from("products")
      .select("*, seller:profiles!products_seller_id_fkey(full_name, avatar_url, rating)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const categorySlug = categoryFilterLabelToDbValue(selectedCategory);
    if (categorySlug) {
      query = query.eq("category", categorySlug);
    }

    const { data, error: queryError } = await query.range(from, to);

    if (queryError) {
      if (isNewCategory) {
        setProducts([]);
      }
      setHasMore(false);
      setError(queryError.message);
    } else {
      const incoming = (data as ProductWithSeller[]) ?? [];
      setProducts((prev) => (isNewCategory ? incoming : [...prev, ...incoming]));
      setHasMore(incoming.length === LIMIT);
    }

    setIsLoading(false);
    setLoadingMore(false);
  };

  const handleLoadMore = () => {
    if (isLoading || loadingMore || !hasMore) return;
    setPage((prev) => prev + 1);
  };

  useEffect(() => {
    if (page > 0) {
      void fetchProducts();
    }
  }, [page]);

  useEffect(() => {
    setPage(0);
    void fetchProducts(true);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4">
          <Link
            to="/"
            className="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Home
          </Link>
        </div>

        <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />

        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Shop - {categoryLabel}</h1>
          <span className="text-sm text-gray-600">{isLoading ? "Loading..." : `${products.length} products`}</span>
        </div>

        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}
        <SimpleProductGrid
          products={products}
          isLoading={isLoading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
