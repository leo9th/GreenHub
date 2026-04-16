import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import SimpleProductGrid from "../components/SimpleProductGrid";

type ProductRow = Record<string, unknown>;

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterSelection>("All");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    if (selectedCategory === "All") return "All Categories";
    return selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("products")
        .select("*, profiles(full_name, username, phone)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(20);

      if (selectedCategory !== "All") {
        query = query.eq("category", selectedCategory);
      }

      const { data, error: queryError } = await query;

      if (cancelled) return;

      if (queryError) {
        setProducts([]);
        setError(queryError.message);
      } else {
        setProducts((data as ProductRow[]) ?? []);
      }

      setLoading(false);
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
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
          <span className="text-sm text-gray-600">{loading ? "Loading..." : `${products.length} products`}</span>
        </div>

        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}
        <SimpleProductGrid products={products} loading={loading} />
      </div>
    </div>
  );
}
