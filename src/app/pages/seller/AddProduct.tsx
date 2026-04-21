import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Upload, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { Progress } from "../../components/ui/progress";
import { uploadStorageObjectWithProgress } from "../../utils/storageUploadWithProgress";
import { categories, nigerianStates } from "../../data/catalogConstants";
import {
  INTERNATIONAL_SHIPPING_PRESETS,
  parseInternationalShippingFees,
  type InternationalShippingFeeRow,
} from "../../data/internationalShippingPresets";
import { CAR_BRAND_SELECT_OTHER, NIGERIA_CAR_BRAND_OPTIONS } from "../../data/carBrands";
import { supabaseErrorMessage } from "../../utils/supabaseErrorMessage";
import { MAX_PRODUCT_IMAGES, parseProductImagesFromRow } from "../../utils/productImages";
import { getConditionOptionsForCategorySlug } from "../../data/productConditions";

const STORAGE_BUCKET = "products";

export default function AddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: authUser, loading: authLoading } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  /** 0–100 while new images upload; null when idle */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  /** Existing remote URLs kept for this listing (edit mode); order = main first. */
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<string>(() => getConditionOptionsForCategorySlug("")[0] ?? "New");
  const [location, setLocation] = useState("");
  const [carBrandSelect, setCarBrandSelect] = useState<string>(NIGERIA_CAR_BRAND_OPTIONS[0]?.value ?? "");
  const [carBrandOther, setCarBrandOther] = useState("");
  /** Keys = preset ids (usa, uk, …); values = fee + ETA for international shipping. */
  const [intlShippingById, setIntlShippingById] = useState<Record<string, InternationalShippingFeeRow>>({});
  const prefillTitle = (searchParams.get("item") ?? "").trim();

  useEffect(() => {
    if (isEdit) return;
    if (!prefillTitle) return;
    setTitle((prev) => (prev.trim() ? prev : prefillTitle));
  }, [isEdit, prefillTitle]);

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
      const cat = typeof data.category === "string" ? data.category : "";
      setCategory(cat);
      const cond = typeof data.condition === "string" ? data.condition : "";
      const opts = getConditionOptionsForCategorySlug(cat);
      const tidy = cond === "Good Fair" ? "Good" : cond;
      setCondition(opts.includes(tidy) ? tidy : opts[0] ?? "New");
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
      setStockQuantity(
        data.stock_quantity != null && Number.isFinite(Number(data.stock_quantity))
          ? String(Math.max(0, Number(data.stock_quantity)))
          : "1",
      );
      setExistingImageUrls(parseProductImagesFromRow(data as { image?: unknown; images?: unknown }));

      const feeMap = parseInternationalShippingFees(
        (data as { international_shipping_fees?: unknown }).international_shipping_fees,
      );
      const dest = (data as { shipping_destinations?: unknown }).shipping_destinations;
      const nextIntl: Record<string, InternationalShippingFeeRow> = {};
      if (Array.isArray(dest)) {
        for (const raw of dest) {
          if (typeof raw !== "string") continue;
          const preset = INTERNATIONAL_SHIPPING_PRESETS.find((p) => p.id === raw);
          const row = feeMap[raw];
          nextIntl[raw] = {
            fee: row?.fee ?? preset?.defaultFee ?? 0,
            duration: row?.duration ?? preset?.defaultDuration ?? "7-14 days",
          };
        }
      }
      setIntlShippingById(nextIntl);
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, id, authUser?.id, authLoading, navigate]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    const availableSlots = MAX_PRODUCT_IMAGES - existingImageUrls.length - imageFiles.length;
    const filesToAdd = files.slice(0, Math.max(0, availableSlots));
    
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

  const removeExistingUrl = (index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleIntlPreset = (presetId: string) => {
    setIntlShippingById((prev) => {
      const next = { ...prev };
      if (next[presetId]) {
        delete next[presetId];
      } else {
        const preset = INTERNATIONAL_SHIPPING_PRESETS.find((p) => p.id === presetId);
        next[presetId] = {
          fee: preset?.defaultFee ?? 0,
          duration: preset?.defaultDuration ?? "7-14 days",
        };
      }
      return next;
    });
  };

  const updateIntlField = (presetId: string, field: "fee" | "duration", raw: string) => {
    setIntlShippingById((prev) => {
      const cur = prev[presetId];
      if (!cur) return prev;
      if (field === "fee") {
        const n = Number.parseFloat(raw.replace(/,/g, ""));
        return {
          ...prev,
          [presetId]: { ...cur, fee: Number.isFinite(n) ? Math.max(0, n) : 0 },
        };
      }
      return { ...prev, [presetId]: { ...cur, duration: raw } };
    });
  };

  const uploadNewImages = async (onProgress: (pct: number) => void): Promise<string[]> => {
    if (!authUser?.id) return [];
    const urls: string[] = [];
    let firstUploadError: unknown = null;
    const total = imageFiles.length;
    const report = (fileIndex: number, filePct: number) => {
      const slice = ((fileIndex + filePct / 100) / Math.max(total, 1)) * 100;
      onProgress(Math.min(100, Math.round(slice)));
    };

    for (let i = 0; i < imageFiles.length; i++) {
      const item = imageFiles[i];
      const fileExt = item.file.name.split(".").pop() || "jpg";
      const fileName = `${authUser.id}/${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}.${fileExt}`;

      try {
        await uploadStorageObjectWithProgress(STORAGE_BUCKET, fileName, item.file, (p) => report(i, p));
      } catch (e) {
        if (firstUploadError == null) firstUploadError = e;
        console.warn("Image upload failed:", fileName, e);
        report(i, 100);
        continue;
      }

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
      if (data?.publicUrl) urls.push(data.publicUrl);
      report(i, 100);
    }

    if (imageFiles.length > 0 && urls.length === 0 && firstUploadError != null) {
      throw new Error(
        `Image upload failed: ${supabaseErrorMessage(
          firstUploadError,
          `Check that Storage bucket "${STORAGE_BUCKET}" exists and policies allow authenticated uploads.`,
        )}`,
      );
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
    const stockQtyNum = Math.floor(Number(stockQuantity));
    if (!Number.isFinite(stockQtyNum) || stockQtyNum < 0) {
      alert("Please enter a valid stock quantity.");
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

    if (existingImageUrls.length + imageFiles.length === 0) {
      alert(isEdit ? "Please keep at least one image or upload a new one." : "Please upload at least one product image.");
      return;
    }

    setIsSaving(true);
    setUploadProgress(imageFiles.length > 0 ? 0 : null);

    try {
      const intlKeys = Object.keys(intlShippingById);
      const shippingDestPayload = intlKeys.length ? intlKeys : null;
      const intlFeesPayload = intlKeys.length ? intlShippingById : null;

      const uploadedUrls = await uploadNewImages((pct) => setUploadProgress(pct));
      const imageUrls = [...existingImageUrls, ...uploadedUrls].slice(0, MAX_PRODUCT_IMAGES);
      const mainImage = imageUrls[0];

      if (!mainImage?.trim()) {
        throw new Error("Could not determine product image URL. Check storage permissions or try again.");
      }

      if (isEdit && id) {
        const updatePayload: Record<string, unknown> = {
        title: title.trim(),
          description: description.trim(),
        price_local: priceLocalNum,
        image: mainImage,
          images: imageUrls,
          category: category.trim(),
          condition,
          location: location.trim(),
          car_brand: carBrandValue,
          shipping_destinations: shippingDestPayload,
          international_shipping_fees: intlFeesPayload,
          stock_quantity: stockQtyNum,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", id)
          .eq("seller_id", authUser.id);

        if (updateError) throw updateError;

        toast.success("Product Published!", { description: "Your listing was updated." });
        navigate("/seller/products");
        return;
      }

      const insertPayload = {
        seller_id: authUser.id,
        title: title.trim(),
        description: description.trim(),
        price_local: priceLocalNum,
        image: mainImage,
        images: imageUrls,
        category: category.trim(),
        condition,
        location: location.trim(),
        car_brand: carBrandValue,
        shipping_destinations: shippingDestPayload,
        international_shipping_fees: intlFeesPayload,
        stock_quantity: stockQtyNum,
        status: "active" as const,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("products").insert([insertPayload]).select("id");

      if (insertError) throw insertError;

      toast.success(prefillTitle ? "Opportunity listed successfully!" : "Product Published!", {
        description: prefillTitle
          ? `Your "${title.trim() || prefillTitle}" listing is now live from Market Demand.`
          : "Your listing is live.",
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        className: "bg-emerald-50 text-emerald-950 border border-emerald-200/80",
      });
      navigate("/seller/products");
    } catch (error: unknown) {
      console.error("Save failed:", error);
      const msg = supabaseErrorMessage(error, "Product could not be saved.");
      const isUpload = String(msg).toLowerCase().includes("upload");
      toast.error(isUpload ? "Upload Failed" : "Could not save", { description: msg });
    } finally {
      setUploadProgress(null);
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
          <label className="block font-semibold text-gray-800 mb-3">
            Product images * (max {MAX_PRODUCT_IMAGES}, first is the main image)
          </label>
          <p className="text-xs text-gray-500 mb-2">Swipe sideways to see all photos you added.</p>
          <div className="-mx-1 mb-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] touch-pan-x">
            <div className="flex w-max flex-nowrap gap-3 px-1">
              {existingImageUrls.map((url, index) => (
                <div
                  key={`existing-${url}-${index}`}
                  className="relative aspect-square w-[100px] shrink-0 bg-gray-100 rounded-lg overflow-hidden sm:w-[7.5rem]"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingUrl(index)}
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
              {imageFiles.map((img, index) => (
                <div
                  key={img.preview}
                  className="relative aspect-square w-[100px] shrink-0 bg-gray-100 rounded-lg overflow-hidden sm:w-[7.5rem]"
                >
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-[#ef4444] rounded-full flex items-center justify-center text-white shadow-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {existingImageUrls.length + index === 0 && (
                    <span className="absolute bottom-1 left-1 bg-[#22c55e] text-white text-xs px-2 py-0.5 rounded shadow-sm">
                      Main
                    </span>
                  )}
                </div>
              ))}
              {existingImageUrls.length + imageFiles.length < MAX_PRODUCT_IMAGES && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square w-[100px] shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-[#22c55e] hover:text-[#22c55e] transition-colors sm:w-[7.5rem]"
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
          </div>
          {isEdit && existingImageUrls.length === 0 && imageFiles.length === 0 ? (
            <p className="text-xs text-amber-700 p-2 bg-amber-50 rounded-lg">Add at least one image to publish this listing.</p>
          ) : null}
        </div>

        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <label className="block font-semibold text-gray-800 mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                const opts = getConditionOptionsForCategorySlug(next);
                setCondition((prev) => (opts.includes(prev) ? prev : opts[0] ?? "New"));
                if (next !== "vehicles") {
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
              {getConditionOptionsForCategorySlug(category).map((c) => (
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

        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">Stock Quantity *</label>
          <input
            type="number"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            required
            min="0"
            step="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="1"
          />
          <p className="mt-1 text-xs text-gray-500">Set available units. Buyers see low-stock alerts below 5.</p>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">Delivery &amp; shipping</h2>
            <p className="text-xs text-gray-500 mb-3">
              International quick-select (common routes from Nigeria). Set fee and estimated delivery time per destination.
            </p>
            <div className="flex flex-wrap gap-2">
              {INTERNATIONAL_SHIPPING_PRESETS.map((p) => {
                const on = Boolean(intlShippingById[p.id]);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleIntlPreset(p.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? "border-[#22c55e] bg-[#f0fdf4] text-[#15803d]"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-[#22c55e]/50"
                    }`}
                  >
                    <span aria-hidden>{p.flag}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {Object.keys(intlShippingById).length > 0 ? (
            <ul className="space-y-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
              {Object.entries(intlShippingById).map(([id, row]) => {
                const preset = INTERNATIONAL_SHIPPING_PRESETS.find((x) => x.id === id);
                const label = preset ? `${preset.flag} ${preset.label} (${preset.hint})` : id;
                return (
                  <li key={id} className="pt-3 first:pt-0 space-y-2">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Shipping fee (₦)</label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={row.fee}
                          onChange={(e) => updateIntlField(id, "fee", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Est. delivery time</label>
                        <input
                          type="text"
                          value={row.duration}
                          onChange={(e) => updateIntlField(id, "duration", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                          placeholder="7-14 days"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">No international routes selected — buyers only see local / other options you add elsewhere.</p>
          )}
        </div>

        {uploadProgress != null ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/90 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-emerald-900">
              <span>Uploading images</span>
              <span className="tabular-nums">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2 bg-emerald-200/80 [&>[data-slot=progress-indicator]]:bg-[#16a34a]" />
          </div>
        ) : null}

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
