import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Plus, Search, MoreVertical, Edit, Trash2, Loader2, Package } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../hooks/useCurrency";
import { getProductPrice } from "../../utils/getProductPrice";

const PRODUCTS_BUCKET = "products";

type SellerProductRow = {
  id: string | number;
  title: string;
  image: string | null;
  price_local: number | null;
  price: number | null;
  status: string | null;
  created_at: string | null;
};

/** Extract storage object paths from public URLs for this Supabase project bucket. */
function pathsFromImageField(imageField: string | null | undefined, bucket: string): string[] {
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

function formatListedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SellerProducts() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);
  const [products, setProducts] = useState<SellerProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionProductId, setActionProductId] = useState<string | number | null>(null);

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
      .select("id, title, image, price, price_local, status, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setProducts([]);
    } else {
      setProducts(
        (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string | number,
          title: (row.title as string) ?? "",
          image: (row.image as string | null) ?? null,
          price: row.price != null ? Number(row.price) : null,
          price_local: row.price_local != null ? Number(row.price_local) : null,
          status: (row.status as string | null) ?? null,
          created_at: (row.created_at as string | null) ?? null,
        }))
      );
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayAmount = (p: SellerProductRow) => formatPrice(getProductPrice(p));

  const handleDelete = async (product: SellerProductRow) => {
    if (!confirm("Are you sure you want to delete this product?") || !user?.id) {
      setOpenMenuId(null);
      return;
    }

    setActionProductId(product.id);
    setOpenMenuId(null);

    try {
      const paths = pathsFromImageField(product.image, PRODUCTS_BUCKET);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from(PRODUCTS_BUCKET).remove(paths);
        if (storageError) {
          console.warn("Storage delete:", storageError.message);
        }
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("seller_id", user.id);

      if (error) throw new Error(error.message);

      await fetchProducts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      alert(msg);
    } finally {
      setActionProductId(null);
    }
  };

  const handleMarkSold = async (product: SellerProductRow) => {
    if (!user?.id) return;
    setActionProductId(product.id);
    setOpenMenuId(null);

    try {
      const { error } = await supabase
        .from("products")
        .update({ status: "sold", updated_at: new Date().toISOString() })
        .eq("id", product.id)
        .eq("seller_id", user.id);

      if (error) throw new Error(error.message);

      await fetchProducts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update status";
      alert(msg);
    } finally {
      setActionProductId(null);
    }
  };

  const activeCount = products.filter((p) => (p.status ?? "").toLowerCase() === "active").length;
  const soldCount = products.filter((p) => (p.status ?? "").toLowerCase() === "sold").length;

  if (authLoading || (!user && !authLoading)) {
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
            <h1 className="text-lg font-semibold text-gray-800">My products</h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your listings…"
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
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-[#22c55e]">{activeCount}</p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-700">{soldCount}</p>
            <p className="text-sm text-gray-600">Sold</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-3">
        {loadError ? <p className="text-center text-red-600 text-sm py-8">{loadError}</p> : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          filteredProducts.map((product) => {
            const statusLower = (product.status ?? "").toLowerCase();
            const statusLabel =
              statusLower === "sold"
                ? "Sold"
                : statusLower === "active"
                  ? "Active"
                  : product.status?.trim()
                    ? product.status
                    : "—";

            return (
              <div
                key={String(product.id)}
                className="group relative bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex gap-3">
                  <Link
                    to={`/products/${product.id}`}
                    className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
                  >
                    <img
                      src={product.image || undefined}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.src =
                          "data:image/svg+xml," +
                          encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="#e5e7eb" width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="10">No image</text></svg>`
                          );
                      }}
                    />
                  </Link>

                  <div className="flex-1 min-w-0 pr-10 sm:pr-12">
                    <Link to={`/products/${product.id}`} className="block">
                      <h3 className="font-medium text-gray-800 mb-1 line-clamp-2">{product.title}</h3>
                    </Link>
                    <p className="text-lg font-bold text-gray-900 mb-1">{displayAmount(product)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                      <span
                        className={
                          statusLower === "active"
                            ? "text-[#15803d] font-medium"
                            : statusLower === "sold"
                              ? "text-gray-500 font-medium"
                              : "font-medium text-gray-700"
                        }
                      >
                        {statusLabel}
                      </span>
                      {product.created_at ? (
                        <span>Listed {formatListedDate(product.created_at)}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={`/seller/products/edit/${product.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <Edit className="w-4 h-4 shrink-0" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={actionProductId === product.id}
                        onClick={() => void handleDelete(product)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {statusLower !== "sold" ? (
                    <div
                      className={`absolute top-3 right-3 transition-opacity duration-150 ${
                        openMenuId === product.id
                          ? "opacity-100 z-20"
                          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-10"
                      }`}
                    >
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="More listing actions"
                          disabled={actionProductId === product.id}
                          onClick={() => setOpenMenuId(openMenuId === product.id ? null : product.id)}
                          className="p-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-700" />
                        </button>

                        {openMenuId === product.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-40 cursor-default bg-black/0"
                              aria-label="Close menu"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-44">
                              <button
                                type="button"
                                disabled={actionProductId === product.id}
                                onClick={() => void handleMarkSold(product)}
                                className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 text-gray-800 text-sm w-full text-left disabled:opacity-50"
                              >
                                <Package className="w-4 h-4 shrink-0" />
                                Mark as sold
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {!loading && !loadError && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4" aria-hidden>
              📦
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No listings yet</h3>
            <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
              {searchQuery ? "Nothing matches that search." : "Add a product to see it here."}
            </p>
            {!searchQuery ? (
              <Link
                to="/seller/products/new"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold text-sm hover:bg-[#16a34a]"
              >
                Add product
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <Link
        to="/seller/products/new"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#22c55e] rounded-full shadow-lg flex items-center justify-center text-white z-30 hover:bg-[#16a34a]"
        aria-label="Add product"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
