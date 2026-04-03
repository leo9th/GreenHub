import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_CURRENCY = "NGN" as const;

const CATEGORIES: { value: string; label: string }[] = [
  { value: "Electronics", label: "📱 Electronics" },
  { value: "Fashion", label: "👗 Fashion" },
  { value: "Home & Garden", label: "🏠 Home & Garden" },
  { value: "Sports", label: "⚽ Sports" },
  { value: "Vehicles", label: "🚗 Vehicles" },
  { value: "Services", label: "💼 Services" },
  { value: "Other", label: "📦 Other" },
];

const CONDITIONS = ["New", "Like New", "Good", "Fair"] as const;

const NIGERIAN_STATES = ["Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Delta", "Kaduna", "Enugu"];

const DELIVERY_OPTIONS = [
  "Local pickup",
  "Nationwide delivery",
  "Pay on delivery",
  "Same-day (where available)",
] as const;

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

/** Build a row that matches `public.products` in supabase_setup.sql */
function buildProductRow(params: {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  location: string;
  condition: string;
  category: string;
  deliveryOptions: string[];
  sellerTier: string | null;
}) {
  const price = Number.isFinite(params.price) ? params.price : 0;

  return {
    seller_id: params.sellerId,
    title: params.title.trim(),
    description: params.description.trim() || null,
    price,
    price_local: price,
    currency_code: DEFAULT_CURRENCY,
    image: params.imageUrl,
    location: params.location.trim() || null,
    condition: params.condition,
    category: params.category.trim() || null,
    rating: 0,
    reviews: 0,
    seller_tier: params.sellerTier?.trim() || null,
    delivery_options:
      params.deliveryOptions.length > 0 ? params.deliveryOptions : null,
  };
}

export default function AddProduct() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [state, setState] = useState(NIGERIAN_STATES[0]);
  const [lga, setLga] = useState("");
  const [sellerTier, setSellerTier] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  function toggleDelivery(opt: string) {
    setSelectedDelivery((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  }

  async function uploadPrimaryImage(
    sellerId: string,
    file: File
  ): Promise<string | null> {
    const path = `${sellerId}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: false });
    if (upErr) {
      throw new Error(upErr.message || "Image upload failed");
    }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please enter a product title.");
      return;
    }

    const price = parseFloat(priceInput.replace(/,/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    const location =
      lga.trim().length > 0
        ? `${lga.trim()}, ${state}`
        : state;

    setSaving(true);
    try {
      let imageUrl: string | null = null;
      const primary = files[0];
      if (primary) {
        imageUrl = await uploadPrimaryImage(user.id, primary);
      }

      const row = buildProductRow({
        sellerId: user.id,
        title: trimmedTitle,
        description,
        price,
        imageUrl,
        location,
        condition,
        category,
        deliveryOptions: selectedDelivery,
        sellerTier: sellerTier || null,
      });

      const { error: insertError } = await supabase.from("products").insert(row);

      if (insertError) {
        throw new Error(insertError.message);
      }

      navigate("/", { replace: true });
      alert("Product saved successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save product.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7]">
        <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-16 pt-6 px-4">
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 font-medium mb-4 hover:text-[#22c55e]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Add product</h1>
            <p className="text-sm text-gray-500 mt-1">
              Listing uses {DEFAULT_CURRENCY} — currency is set automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {error ? (
              <div
                className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Photos (first image is the main listing photo)
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg py-8 cursor-pointer hover:border-[#22c55e]/50 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Up to 5 images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(ev) => {
                    const list = ev.target.files
                      ? Array.from(ev.target.files).slice(0, 5)
                      : [];
                    setFiles(list);
                  }}
                />
              </label>
              {files.length > 0 ? (
                <p className="text-xs text-gray-500 mt-2">
                  {files.length} file(s) selected — primary: {files[0].name}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#22c55e] mb-1">
                Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="What are you selling?"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
                placeholder="Describe condition, accessories, warranty…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#22c55e] mb-1">
                  Price ({DEFAULT_CURRENCY}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. 25000"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  required
                >
                  <option value="">Select</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  State *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  City / LGA
                </label>
                <input
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Ikeja"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Seller tier (optional)
              </label>
              <input
                value={sellerTier}
                onChange={(e) => setSellerTier(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Verified"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-gray-700 mb-2">
                Delivery options
              </span>
              <div className="space-y-2">
                {DELIVERY_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDelivery.includes(opt)}
                      onChange={() => toggleDelivery(opt)}
                      className="rounded border-gray-300 text-[#22c55e] focus:ring-[#22c55e]"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#22c55e] text-white font-semibold py-3 rounded-lg text-sm hover:bg-[#16a34a] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Publish product"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
