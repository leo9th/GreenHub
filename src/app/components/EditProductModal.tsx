import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { categories } from "../data/catalogConstants";
import { supabaseErrorMessage } from "../utils/supabaseErrorMessage";
import { MAX_PRODUCT_IMAGES, parseProductImagesFromRow } from "../utils/productImages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const STORAGE_BUCKET = "products";

type GalleryItem =
  | { kind: "remote"; url: string }
  | { kind: "local"; file: File; preview: string };

type ProductRow = {
  id: number | string;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  price_local?: unknown;
  price?: unknown;
  image?: unknown;
  images?: unknown;
  seller_id?: unknown;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null;
  onSaved: () => void;
};

export function EditProductModal({ open, onOpenChange, product, onSaved }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [saving, setSaving] = useState(false);

  const resetFromProduct = useCallback(() => {
    if (!product) return;
    setTitle(typeof product.title === "string" ? product.title : String(product.title ?? ""));
    setDescription(typeof product.description === "string" ? product.description : String(product.description ?? ""));
    setCategory(typeof product.category === "string" ? product.category : "");
    const local = product.price_local;
    const legacy = product.price;
    const n =
      local != null && Number.isFinite(Number(local))
        ? Number(local)
        : legacy != null && Number.isFinite(Number(legacy))
          ? Number(legacy)
          : 0;
    setPrice(n > 0 ? String(n) : "");
    const urls = parseProductImagesFromRow(product as { image?: unknown; images?: unknown });
    setGallery(urls.map((url) => ({ kind: "remote" as const, url })));
  }, [product]);

  useEffect(() => {
    if (open && product) resetFromProduct();
  }, [open, product, resetFromProduct]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = MAX_PRODUCT_IMAGES - gallery.length;
    const toAdd = files.slice(0, Math.max(0, slots));
    setGallery((prev) => [
      ...prev,
      ...toAdd.map((file) => ({ kind: "local" as const, file, preview: URL.createObjectURL(file) })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    setGallery((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.kind === "local") URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    setGallery((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const uploadLocals = async (): Promise<string[]> => {
    if (!user?.id) return [];
    const urls: string[] = [];
    for (const item of gallery) {
      if (item.kind === "remote") {
        urls.push(item.url);
        continue;
      }
      const fileExt = item.file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, item.file, {
        upsert: false,
      });
      if (uploadError) {
        console.warn(uploadError);
        continue;
      }
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSave = async () => {
    if (!user?.id || !product) return;
    const sellerId = product.seller_id != null ? String(product.seller_id) : "";
    if (sellerId !== user.id) {
      return;
    }
    if (!title.trim() || !description.trim() || !category.trim()) {
      return;
    }
    const priceNum = Number.parseFloat(String(price).replace(/,/g, ""));
    if (!Number.isFinite(priceNum) || priceNum < 0) return;
    if (gallery.length === 0) return;

    setSaving(true);
    try {
      const imageUrls = await uploadLocals();
      const main = imageUrls[0];
      if (!main?.trim()) throw new Error("Could not save images. Check storage permissions.");

      const { error } = await supabase
        .from("products")
        .update({
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          price_local: priceNum,
          image: main,
          images: imageUrls,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("seller_id", user.id);

      if (error) throw error;
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      console.error(e);
      alert(supabaseErrorMessage(e, "Could not update listing."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Update your listing. First image is the cover photo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">Images (max {MAX_PRODUCT_IMAGES})</label>
            <div className="flex flex-wrap gap-3">
              {gallery.map((item, index) => (
                <div
                  key={item.kind === "remote" ? `r-${item.url}-${index}` : item.preview}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200"
                >
                  <img
                    src={item.kind === "remote" ? item.url : item.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-1 top-1 flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="rounded bg-white/90 p-0.5 text-gray-700 shadow hover:bg-white"
                      aria-label="Move up"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded bg-white/90 p-0.5 text-gray-700 shadow hover:bg-white"
                      aria-label="Move down"
                      onClick={() => move(index, 1)}
                      disabled={index === gallery.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow"
                    aria-label="Remove image"
                    onClick={() => removeAt(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {index === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded bg-[#22c55e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Main
                    </span>
                  ) : null}
                </div>
              ))}
              {gallery.length < MAX_PRODUCT_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#22c55e] hover:text-[#15803d]"
                >
                  <Upload className="mb-1 h-6 w-6" />
                  <span className="text-[10px]">Add</span>
                </button>
              ) : null}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
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
            <label className="block text-sm font-medium text-gray-800 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Price (₦)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
