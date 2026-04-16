import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { categories } from "../data/catalogConstants";
import { supabase } from "../../lib/supabase";
import SimpleProductGrid from "../components/SimpleProductGrid";

type ProductRow = Record<string, unknown>;

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "all";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    if (selectedCategory === "all") return "All Categories";
    return categories.find((category) => category.id === selectedCategory)?.name ?? selectedCategory;
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

      if (selectedCategory !== "all") {
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/" className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700">
            Home
          </Link>
          <button
            type="button"
            onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("category");
              return next;
            })}
            className={`rounded-full border px-3 py-1 text-sm ${
              selectedCategory === "all"
                ? "border-[#16a34a] bg-[#16a34a]/10 text-[#15803d]"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("category", category.id);
                  return next;
                })
              }
              className={`rounded-full border px-3 py-1 text-sm ${
                selectedCategory === category.id
                  ? "border-[#16a34a] bg-[#16a34a]/10 text-[#15803d]"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              {category.emoji} {category.name}
            </button>
          ))}
        </div>

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
