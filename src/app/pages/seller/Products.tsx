import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";

const PRODUCTS_BUCKET = "products";

type SellerProductRow = {
  id: number;
  title: string;
  image: string | null;
  price: number | null;
  price_local: number | null;
  views?: number;
  stock?: number;
  status?: string;
};

/** Extract storage object paths from public URLs for this Supabase project bucket. */
function pathsFromImageField(
  imageField: string | null | undefined,
  bucket: string
): string[] {
  if (!imageField?.trim()) return [];
  const urls = imageField
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const marker = `/object/public/${bucket}/`;
  const paths: string[] = [];
  for (const raw of urls) {
    const url = raw.split("?")[0];
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    try {
      paths.push(decodeURIComponent(url.slice(idx + marker.length)));
    } catch {
      continue;
    }
  }
  return paths;
}

export default function SellerProducts() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showActions, setShowActions] = useState<number | null>(null);
  const [products, setProducts] = useState<SellerProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, image, price, price_local")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setProducts([]);
    } else {
      setProducts(
        (data ?? []).map((row) => ({
          id: Number(row.id),
          title: row.title ?? "",
          image: row.image ?? null,
          price: row.price != null ? Number(row.price) : null,
          price_local:
            row.price_local != null ? Number(row.price_local) : null,
          views: 0,
          stock: 0,
          status: "active",
        }))
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [user, navigate]);

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayAmount = (p: SellerProductRow) => {
    const n = p.price_local ?? p.price ?? 0;
    return formatPrice(n);
  };

  const handleDelete = async (product: SellerProductRow) => {
    if (
      !confirm("Are you sure you want to delete this product?") ||
      !user?.id
    ) {
      setShowActions(null);
      return;
    }

    setDeletingId(product.id);
    setShowActions(null);

    try {
      const paths = pathsFromImageField(product.image, PRODUCTS_BUCKET);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(PRODUCTS_BUCKET)
          .remove(paths);
        if (storageError) {
          console.warn("Storage delete:", storageError.message);
        }
      }

      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("seller_id", user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      alert("Product deleted successfully");
      await fetchProducts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStatus = (productId: number) => {
    console.log("Toggle status:", productId);
    setShowActions(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">My Products</h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-sm text-gray-600">Total Products</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-[#22c55e]">
              {products.filter((p) => p.status === "active").length}
            </p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-500">
              {products.filter((p) => p.status === "inactive").length}
            </p>
            <p className="text-sm text-gray-600">Inactive</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-3">
        {loadError ? (
          <p className="text-center text-red-600 text-sm py-8">{loadError}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg p-4 border border-gray-200"
            >
              <div className="flex gap-3">
                <Link
                  to={`/products/${product.id}`}
                  className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
                >
                  <img
                    src={product.image || "/favicon.svg"}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/products/${product.id}`}>
                    <h3 className="font-medium text-gray-800 mb-1 line-clamp-2">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="text-lg font-bold text-gray-900 mb-2">
                    {displayAmount(product)}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">{product.views} views</span>
                    <span
                      className={
                        (product.stock ?? 0) > 0
                          ? "text-[#22c55e]"
                          : "text-red-500"
                      }
                    >
                      {(product.stock ?? 0) > 0
                        ? `${product.stock} in stock`
                        : "Out of stock"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={deletingId === product.id}
                    onClick={() => handleDelete(product)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === product.id ? "Deleting…" : "Delete"}
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setShowActions(
                          showActions === product.id ? null : product.id
                        )
                      }
                      className="p-2"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>

                    {showActions === product.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowActions(null)}
                          aria-hidden
                        />
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-40">
                          <Link
                            to={`/seller/products/${product.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                            onClick={() => setShowActions(null)}
                          >
                            <Edit className="w-4 h-4" />
                            <span className="text-sm">Edit</span>
                          </Link>
                          <Link
                            to={`/seller/advertise?productId=${product.id}`}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-[#f97316]"
                            onClick={() => setShowActions(null)}
                          >
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm">Boost Ad</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleStatus(product.id)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 w-full"
                          >
                            {product.status === "active" ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                <span className="text-sm">Deactivate</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                <span className="text-sm">Activate</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            disabled={deletingId === product.id}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 w-full disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm">Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {product.status === "inactive" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    This product is inactive and not visible to buyers
                  </p>
                </div>
              )}
            </div>
          ))
        )}

        {!loading && !loadError && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              No products found
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Start by adding your first product"}
            </p>
          </div>
        )}
      </div>

      <Link
        to="/seller/products/add"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#22c55e] rounded-full shadow-lg flex items-center justify-center text-white z-30"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
