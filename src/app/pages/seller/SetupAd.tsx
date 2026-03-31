import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Upload, CheckCircle2, TrendingUp, ImageIcon } from "lucide-react";
import { getMockProductsForRegion } from "../../data/mockData";
import { useRegion } from "../../context/RegionContext";

export default function SetupAd() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const { activeRegion } = useRegion();
  
  const isBanner = plan.startsWith("b-");
  const isFeature = plan.startsWith("f-") || plan.startsWith("p-");

  const [step, setStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const initialProductId = searchParams.get("productId");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(initialProductId ? Number(initialProductId) : null);

  const myProducts = getMockProductsForRegion(activeRegion.id as any).slice(0, 4); // simulate sellers products

  useEffect(() => {
    // Check if they already have stuff in localStorage just to populate it, optional.
  }, []);

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBannerImage(url);
    }
  };

  const handleFinishSetup = () => {
    if (isBanner && bannerImage) {
      localStorage.setItem("greenhub_custom_banner", bannerImage);
    }
    if (isFeature && selectedProductId) {
      localStorage.setItem("greenhub_featured_product", selectedProductId.toString());
    }
    
    // Give time for localStorage to settle, then route to home
    alert("Setup Complete! Taking you to the homepage to see your Ad live!");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/seller/dashboard")} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Set Up Your Ad</h1>
            <p className="text-xs text-gray-500">
              {isBanner ? "Upload your promotional banner" : "Select a product to highlight"}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Payment Successful!</h2>
              <p className="text-sm text-gray-600">Now let's configure your ad so it can start running immediately.</p>
            </div>
          </div>

          <hr className="border-gray-100 mb-6" />

          {isBanner && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-[#22c55e]" />
                Upload Custom Banner
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This banner will be displayed prominently on the main GreenHub homepage carousel.
              </p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 sm:h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#22c55e] hover:bg-green-50/50 transition-colors overflow-hidden group relative"
              >
                {bannerImage ? (
                  <>
                    <img src={bannerImage} alt="Banner Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">Change Image</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#22c55e]" />
                    </div>
                    <p className="font-semibold text-gray-700">Click to upload banner image</p>
                    <p className="text-xs text-gray-500 mt-1">1200 x 400px recommended</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleBannerUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>
          )}

          {isFeature && (
            <div className={isBanner ? "mt-10 pt-10 border-t border-gray-100" : ""}>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#22c55e]" />
                Select Product to Highlight
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose which of your existing product listings you want to push to the top of buyer searches.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {myProducts.map((product) => (
                  <div 
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                      selectedProductId === product.id 
                        ? "border-[#22c55e] bg-green-50 shadow-sm" 
                        : "border-gray-200 hover:border-[#22c55e]/50"
                    }`}
                  >
                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2">{product.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{product.condition}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mx-2 ${
                      selectedProductId === product.id ? "border-[#22c55e] bg-[#22c55e]" : "border-gray-300"
                    }`}>
                      {selectedProductId === product.id && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleFinishSetup}
          disabled={(isBanner && !bannerImage) || (isFeature && !selectedProductId)}
          className="w-full py-4 bg-[#22c55e] text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#16a34a] transition-colors shadow-sm"
        >
          Publish Ad & Go to Homepage
        </button>

      </div>
    </div>
  );
}
