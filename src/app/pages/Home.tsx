import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import CategoryFilter, { type CategoryFilterSelection } from "../components/CategoryFilter";
import SimpleProductGrid from "../components/SimpleProductGrid";

type ProductRow = Record<string, unknown>;

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterSelection>("All");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Featured Products</h1>
          <Link to="/products" className="text-sm font-medium text-[#16a34a] hover:underline">
            Go to Shop
          </Link>
        </div>

        <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />

        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}
        <SimpleProductGrid products={products} loading={loading} />
      </div>
    </div>
  );
}
