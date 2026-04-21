import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../hooks/useCurrency";

const TRENDING_CATEGORIES = ["Electronics", "Farm Fresh", "Gadgets", "Fashion", "Home & Kitchen", "Automotive"] as const;
const MIN_SEARCH_LENGTH = 2;
const categorySynonyms: Record<string, (typeof TRENDING_CATEGORIES)[number]> = {
  phone: "Electronics",
  iphone: "Electronics",
  android: "Electronics",
  laptop: "Electronics",
  gadget: "Gadgets",
  gadgets: "Gadgets",
  yam: "Farm Fresh",
  rice: "Farm Fresh",
  cassava: "Farm Fresh",
  tomato: "Farm Fresh",
  cloth: "Fashion",
  clothes: "Fashion",
  shirt: "Fashion",
  dress: "Fashion",
};

type ProductLite = {
  id: number | string;
  title: string | null;
  category: string | null;
  image: string | null;
  price_local: number | null;
  price: number | null;
};

type AdvancedSearchProps = {
  className?: string;
  placeholder?: string;
  value?: string;
  onQueryChange?: (query: string) => void;
  showTopRatedToggle?: boolean;
  topRatedOnly?: boolean;
  onTopRatedOnlyChange?: (next: boolean) => void;
  onSelectProduct?: (productId: string) => void;
  onSelectCategory?: (category: string) => void;
};

function productAmount(p: ProductLite): number {
  return Number(p.price_local ?? p.price) || 0;
}

export default function AdvancedSearch({
  className = "",
  placeholder = "Search products instantly...",
  value,
  onQueryChange,
  showTopRatedToggle = false,
  topRatedOnly = false,
  onTopRatedOnlyChange,
  onSelectProduct,
  onSelectCategory,
}: AdvancedSearchProps) {
  const navigate = useNavigate();
  const formatPrice = useCurrency();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [requesting, setRequesting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const synonymMatchedCategory = categorySynonyms[normalizedQuery] ?? null;

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  const fallbackCategories = useMemo(() => {
    if (!normalizedQuery) return [...TRENDING_CATEGORIES];
    const filtered = TRENDING_CATEGORIES.filter((c) => c.toLowerCase().includes(normalizedQuery));
    if (!synonymMatchedCategory) return filtered;
    const withoutMatched = filtered.filter((c) => c !== synonymMatchedCategory);
    return [synonymMatchedCategory, ...withoutMatched];
  }, [normalizedQuery, synonymMatchedCategory]);

  const showRequestButton =
    normalizedQuery.length >= MIN_SEARCH_LENGTH &&
    products.length === 0 &&
    !fallbackCategories.some((c) => c.toLowerCase() === normalizedQuery);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < MIN_SEARCH_LENGTH) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = window.setTimeout(async () => {
      const term = query.trim();
      let topRatedSellerIds: string[] = [];
      if (topRatedOnly) {
        const { data: sellerRows, error: sErr } = await supabase.from("profiles").select("id").gte("rating", 4.5);
        if (sErr) {
          if (!cancelled) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }
        topRatedSellerIds = (sellerRows ?? []).map((r) => String(r.id)).filter(Boolean);
        if (topRatedSellerIds.length === 0) {
          if (!cancelled) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }
      }

      let productQuery = supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .or(`title.ilike.%${term}%,category.ilike.%${term}%`);
      if (topRatedOnly) {
        productQuery = productQuery.in("seller_id", topRatedSellerIds);
      }
      const { data, error } = await productQuery.limit(5);

      if (cancelled) return;
      if (error) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setProducts((data ?? []) as ProductLite[]);
      setLoading(false);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, topRatedOnly]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handlePickProduct = useCallback(
    (productId: number | string) => {
      const id = String(productId);
      setOpen(false);
      if (onSelectProduct) onSelectProduct(id);
      else navigate(`/products/${encodeURIComponent(id)}`);
    },
    [navigate, onSelectProduct],
  );

  const handlePickCategory = useCallback(
    (category: string) => {
      setQuery(category);
      onQueryChange?.(category);
      setOpen(false);
      if (onSelectCategory) onSelectCategory(category);
      else navigate(`/products?search=${encodeURIComponent(category)}`);
    },
    [navigate, onQueryChange, onSelectCategory],
  );

  const handleRequestItem = useCallback(async () => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) return;

    setRequesting(true);
    try {
      const { data: existing, error: existingErr } = await supabase
        .from("requested_items")
        .select("*")
        .ilike("item_name", term)
        .limit(1);
      if (existingErr) throw existingErr;

      if ((existing ?? []).length > 0) {
        toast.message("Already requested", { description: "This item is already on the waitlist." });
        return;
      }

      const { error } = await supabase.from("requested_items").insert({
        item_name: term,
        requested_by: user?.id ?? null,
      });
      if (error) throw error;

      toast.success("Request submitted", { description: "We'll notify sellers that buyers are looking for this item." });
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit request");
    } finally {
      setRequesting(false);
    }
  }, [query, user?.id]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onQueryChange?.(next);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/30 bg-white/60 py-3 pl-11 pr-4 text-sm text-gray-900 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md placeholder:text-gray-500 focus:border-[#22c55e]/40 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
        />
      </div>
      {showTopRatedToggle ? (
        <div className="mt-2 flex items-center justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={topRatedOnly}
              onChange={(e) => onTopRatedOnlyChange?.(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-[#22c55e] focus:ring-[#22c55e]"
            />
            Show Top Rated Sellers Only
          </label>
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/30 bg-white/35 shadow-[0_20px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching products...
            </div>
          ) : products.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePickProduct(p.id);
                  }}
                  className="flex w-full items-center gap-3 border-b border-white/20 px-4 py-3 text-left transition-colors hover:bg-white/40"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/70">
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{p.title || "Product"}</p>
                    <p className="text-xs text-gray-600">{formatPrice(productAmount(p))}</p>
                  </div>
                  {p.category ? <span className="text-[11px] text-gray-600">{p.category}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">Trending Categories</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {fallbackCategories.length > 0 ? (
                  fallbackCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePickCategory(category);
                      }}
                      className="rounded-full border border-white/30 bg-white/45 px-3 py-1 text-xs font-medium text-gray-800 hover:bg-white/60"
                    >
                      {category}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-700">No category suggestions for this term.</p>
                )}
              </div>

              {showRequestButton ? (
                <button
                  type="button"
                  disabled={requesting}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleRequestItem();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#16a34a] disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {requesting ? "Requesting..." : `Request Item: "${query.trim()}"`}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
