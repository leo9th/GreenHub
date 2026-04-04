import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Upload, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { categories, nigerianStates } from "../../data/mockData";
import { CAR_BRAND_SELECT_OTHER, NIGERIA_CAR_BRAND_OPTIONS } from "../../data/carBrands";

const STORAGE_BUCKET = "products";

const PRODUCT_CONDITIONS = ["New", "Like New", "Good Fair"] as const;

export default function AddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: authUser, loading: authLoading } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<string>(PRODUCT_CONDITIONS[0]);
  const [location, setLocation] = useState("");
  const [carBrandSelect, setCarBrandSelect] = useState<string>(NIGERIA_CAR_BRAND_OPTIONS[0]?.value ?? "");
  const [carBrandOther, setCarBrandOther] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!authUser?.id) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isEdit || !id) return;

    let cancelled = false;
    setLoadingProduct(true);
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("seller_id", authUser.id)
        .maybeSingle();

      if (cancelled) return;
      setLoadingProduct(false);

      if (error || !data) {
        alert(error?.message ?? "Product not found.");
        navigate("/seller/products", { replace: true });
        return;
      }

      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setCategory(typeof data.category === "string" ? data.category : "");
      const cond = typeof data.condition === "string" ? data.condition : "";
      setCondition(
        PRODUCT_CONDITIONS.includes(cond as (typeof PRODUCT_CONDITIONS)[number]) ? cond : PRODUCT_CONDITIONS[0],
      );
      setLocation(typeof data.location === "string" ? data.location : "");
      const existingBrand = typeof data.car_brand === "string" ? data.car_brand.trim() : "";
      const presetValues = new Set(NIGERIA_CAR_BRAND_OPTIONS.map((o) => o.value));
      if (existingBrand && presetValues.has(existingBrand)) {
        setCarBrandSelect(existingBrand);
        setCarBrandOther("");
      } else if (existingBrand) {
        setCarBrandSelect(CAR_BRAND_SELECT_OTHER);
        setCarBrandOther(existingBrand);
      } else {
        setCarBrandSelect(NIGERIA_CAR_BRAND_OPTIONS[0]?.value ?? "");
        setCarBrandOther("");
      }
      const local = data.price_local;
      const legacy = data.price;
      const n =
        local != null && Number.isFinite(Number(local))
          ? Number(local)
          : legacy != null && Number.isFinite(Number(legacy))
            ? Number(legacy)
            : null;
      setPrice(n != null ? String(n) : "");
      setExistingImageUrl(typeof data.image === "string" && data.image.trim() ? data.image : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, id, authUser?.id, authLoading, navigate]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    const availableSlots = 5 - imageFiles.length;
    const filesToAdd = files.slice(0, availableSlots);
    
    const newImageFiles = filesToAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    
    if (newImageFiles.length > 0) {
      setImageFiles((prev) => [...prev, ...newImageFiles]);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (): Promise<string[]> => {
    if (!authUser?.id) return [];
    const urls: string[] = [];

    for (const item of imageFiles) {
      const fileExt = item.file.name.split(".").pop() || "jpg";
      const fileName = `${authUser.id}/${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, item.file, {
        upsert: false,
      });

      if (uploadError) {
        console.warn("Image upload failed:", fileName, uploadError);
        continue;
      }

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authLoading || !authUser?.id) {
      alert("Please sign in before adding a product.");
      return;
    }

    if (!title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (!description.trim()) {
      alert("Please enter a description.");
      return;
    }

    const priceLocalNum = Number.parseFloat(String(price).replace(/,/g, ""));
    if (!Number.isFinite(priceLocalNum) || priceLocalNum < 0) {
      alert("Please enter a valid price.");
      return;
    }

    if (!category.trim()) {
      alert("Please select a category.");
      return;
    }

    if (!location.trim()) {
      alert("Please select or enter a location.");
      return;
    }

    let carBrandValue: string | null = null;
    if (category === "vehicles") {
      if (carBrandSelect === CAR_BRAND_SELECT_OTHER) {
        const t = carBrandOther.trim();
        if (!t) {
          alert("Enter the car brand, or pick one from the list.");
          return;
        }
        carBrandValue = t;
      } else {
        carBrandValue = carBrandSelect;
      }
    }

    if (!isEdit && imageFiles.length === 0) {
      alert("Please upload at least one product image.");
      return;
    }

    if (isEdit && imageFiles.length === 0 && !existingImageUrl) {
      alert("Please keep an existing image or upload a new one.");
      return;
    }

    setIsSaving(true);

    try {
      const uploadedUrls = await uploadNewImages();
      const mainImage =
        uploadedUrls[0] ?? (isEdit ? existingImageUrl : null);

      if (!mainImage?.trim()) {
        throw new Error("Could not determine product image URL. Check storage permissions or try again.");
      }

      if (isEdit && id) {
        const updatePayload: Record<string, unknown> = {
        title: title.trim(),
          description: description.trim(),
        price_local: priceLocalNum,
        image: mainImage,
          category: category.trim(),
          condition,
          location: location.trim(),
          car_brand: carBrandValue,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", id)
          .eq("seller_id", authUser.id);

        if (updateError) throw updateError;

        alert("Product updated successfully.");
        navigate("/seller/products");
        return;
      }

      const insertPayload = {
        seller_id: authUser.id,
        title: title.trim(),
        description: description.trim(),
        price_local: priceLocalNum,
        image: mainImage,
        category: category.trim(),
        condition,
        location: location.trim(),
        car_brand: carBrandValue,
        status: "active" as const,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("products").insert([insertPayload]).select("id");

      if (insertError) throw insertError;

      alert("Product listed successfully.");
      navigate("/seller/products");
    } catch (error: unknown) {
      console.error("Save failed:", error);
      const msg = error instanceof Error ? error.message : "Product could not be saved.";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  if (isEdit && loadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading product…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{isEdit ? "Edit Product" : "Add New Product"}</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">Product images * (max 5, first is the main image)</label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {imageFiles.map((img, index) => (
              <div key={img.preview} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-[#ef4444] rounded-full flex items-center justify-center text-white shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 bg-[#22c55e] text-white text-xs px-2 py-0.5 rounded shadow-sm">
                    Main
                  </span>
                )}
              </div>
            ))}
            {imageFiles.length < 5 && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-[#22c55e] hover:text-[#22c55e] transition-colors"
                >
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-xs">Upload</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*" 
                  multiple
                  className="hidden" 
                />
              </>
            )}
          </div>
          {isEdit && existingImageUrl && imageFiles.length === 0 ? (
            <div className="rounded-lg border border-gray-200 overflow-hidden max-w-xs">
              <img src={existingImageUrl} alt="Current listing" className="w-full h-40 object-cover" />
              <p className="text-xs text-[#16a34a] p-2 bg-green-50">Current photo — upload new images above to replace.</p>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <label className="block font-semibold text-gray-800 mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value !== "vehicles") {
                  setCarBrandSelect(NIGERIA_CAR_BRAND_OPTIONS[0]?.value ?? "");
                  setCarBrandOther("");
                }
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-gray-800 mb-2">Condition *</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              {PRODUCT_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-gray-800 mb-2">Location *</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Select state</option>
              {location && !nigerianStates.some((s) => s.name === location) ? (
                <option value={location}>{location} (current)</option>
              ) : null}
              {nigerianStates.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Shows in listings and filters (Nigeria).</p>
          </div>
          {category === "vehicles" && (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#f0fdf4] p-4 space-y-3">
              <label className="block font-semibold text-gray-800">Car brand *</label>
              <select
                value={carBrandSelect}
                onChange={(e) => setCarBrandSelect(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] bg-white"
              >
                {NIGERIA_CAR_BRAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value={CAR_BRAND_SELECT_OTHER}>Others (type manually)</option>
              </select>
              {carBrandSelect === CAR_BRAND_SELECT_OTHER && (
                <>
                  <label className="block text-sm font-medium text-gray-700">Brand name *</label>
                  <input
                    type="text"
                    value={carBrandOther}
                    onChange={(e) => setCarBrandOther(e.target.value)}
                    placeholder="e.g. Innoson"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] bg-white"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="E.g. iPhone 13 Pro Max 256GB"
          />
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="Describe condition, accessories, and anything the buyer should know."
          />
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">Price (₦) *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            step="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="0"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-[#22c55e] text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-[#16a34a] transition-colors"
          >
            {isSaving ? "Saving…" : isEdit ? "Update product" : "List product"}
          </button>
        </div>
      </form>
    </div>
  );
}
