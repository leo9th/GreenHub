import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import SimpleProductGrid from "../components/SimpleProductGrid";

type ProductRow = Record<string, unknown>;

export default function Home() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("products")
        .select("*, profiles(full_name, username, phone)")
        .eq("status", "active")
        .eq("category", "Fashion")
        .order("created_at", { ascending: false })
        .limit(20);

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
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Featured Products</h1>
          <Link to="/products" className="text-sm font-medium text-[#16a34a] hover:underline">
            Go to Shop
          </Link>
        </div>

        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}
        <SimpleProductGrid products={products} loading={loading} />
      </div>
    </div>
  );
}
