import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Upload, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import {  categories, nigerianStates, getLGAsForState, deliveryServices  } from "../../data/mockData";
import { useCurrency } from "../../hooks/useCurrency";

export default function AddProduct() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuth();

  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [delivery, setDelivery] = useState<string[]>([]);

  const conditions = ["New", "Like New", "Good", "Fair"];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    // Only take enough to satisfy the 5 max limit
    const availableSlots = 5 - imageFiles.length;
    const filesToAdd = files.slice(0, availableSlots);
    
    const newImageFiles = filesToAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    if (newImageFiles.length > 0) {
      setImageFiles(prev => [...prev, ...newImageFiles]);
    }
    
    // Reset file input so same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const toggleDelivery = (deliveryName: string) => {
    if (delivery.includes(deliveryName)) {
      setDelivery(delivery.filter(d => d !== deliveryName));
    } else {
      setDelivery([...delivery, deliveryName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      alert("Please sign in before adding a product.");
      return;
    }

    if (imageFiles.length === 0) {
      alert("Please upload at least one product image.");
      return;
    }

    setIsUploading(true);

    let uploadedUrls: string[] = [];

    try {
      if (!authUser?.id) {
        throw new Error("You must be signed in to add a product.");
      }

      // Serially upload each image to Supabase storage to handle multiple files safely.
      // If storage fails, still continue and insert the product row so it is visible to all users.
      for (const item of imageFiles) {
        const fileExt = item.file.name.split('.').pop();
        const fileName = `${authUser.id}/${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, item.file);

        if (uploadError) {
          console.warn('Image upload failed for', fileName, uploadError);
          continue;
        }

        const { data } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        if (data?.publicUrl) {
          uploadedUrls.push(data.publicUrl);
        }
      }

      console.log("Successfully Uploaded Permanent Image URLs:", uploadedUrls);
      console.log("Product Form Data:", { title, description, price, category, condition, state, lga, delivery });

      const productPayload = {
        seller_id: authUser.id,
        title,
        description,
        price: Number(price),
        image: uploadedUrls[0] || null,
        location: lga && state ? `${lga}, ${state}` : state || null,
        condition: condition || null,
        category: category || null,
        rating: 5.0,
        reviews: 0,
        seller_tier: "standard",
        delivery_options: delivery,
      };

      const { data: insertData, error: insertError } = await supabase
        .from("products")
        .insert([productPayload])
        .select();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw insertError;
      }

      console.log("Supabase insert succeeded:", insertData);
      alert("Product successfully saved to Supabase and is now available to all users.");
      navigate("/products");
    } catch (error: any) {
      console.error("Supabase save failed:", error);
      alert(error?.message || "Product could not be saved. Please try again.");
      return;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {isEdit ? "Edit Product" : "Add New Product"}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Images */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            Product Images * (Max 5)
          </label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {imageFiles.map((img, index) => (
              <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={img.preview} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
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
          <p className="text-xs text-gray-600">
            First image will be the main product image
          </p>
        </div>

        {/* Title */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">
            Product Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="E.g., iPhone 13 Pro Max 256GB"
          />
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="Describe your product in detail..."
          />
          <p className="text-xs text-gray-600 mt-2">
            Include condition, features, and what's included
          </p>
        </div>

        {/* Price */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-2">
            Price (₦) *
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            placeholder="0"
          />
        </div>

        {/* Category & Condition */}
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              Condition *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {conditions.map((cond) => (
                <label
                  key={cond}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors text-center ${
                    condition === cond
                      ? "border-[#22c55e] bg-[#22c55e]/5"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={cond}
                    checked={condition === cond}
                    onChange={(e) => setCondition(e.target.value)}
                    required
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-800">{cond}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              State *
            </label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setLga("");
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Select state</option>
              {nigerianStates.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              LGA *
            </label>
            <select
              value={lga}
              onChange={(e) => setLga(e.target.value)}
              required
              disabled={!state}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] disabled:bg-gray-100"
            >
              <option value="">Select LGA</option>
              {getLGAsForState(state).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="bg-white rounded-lg p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            Delivery Options *
          </label>
          <div className="space-y-2">
            {deliveryServices.map((service) => (
              <label
                key={service.name}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-[#22c55e] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={delivery.includes(service.name)}
                  onChange={() => toggleDelivery(service.name)}
                  className="w-5 h-5 text-[#22c55e] rounded focus:ring-[#22c55e]"
                />
                <span className="text-2xl">{service.logo}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{service.name}</p>
                  <p className="text-xs text-gray-600">{service.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-4 bg-[#22c55e] text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-[#16a34a] transition-colors"
          >
            {isUploading ? "Uploading Images..." : (isEdit ? "Update Product" : "Add Product")}
          </button>
        </div>
      </form>
    </div>
  );
}
