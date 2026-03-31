import { useState } from "react";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";

type PricingTier = {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
};

type ContentPackages = {
  starter: number;
  business: number;
  premium: number;
  enterprise: number;
};

type MarketPricing = {
  currency: string;
  featureListing: PricingTier;
  bannerAds: PricingTier;
  packages: ContentPackages;
};

const DEFAULT_PRICING: Record<string, MarketPricing> = {
  Nigeria: {
    currency: "₦",
    featureListing: { daily: 500, weekly: 3000, monthly: 10000, yearly: 100000 },
    bannerAds: { daily: 1000, weekly: 6000, monthly: 20000, yearly: 200000 },
    packages: { starter: 25000, business: 75000, premium: 200000, enterprise: 500000 },
  },
  China: {
    currency: "¥",
    featureListing: { daily: 10, weekly: 50, monthly: 180, yearly: 1500 },
    bannerAds: { daily: 20, weekly: 100, monthly: 350, yearly: 3000 },
    packages: { starter: 400, business: 1200, premium: 3000, enterprise: 8000 },
  },
  USA: {
    currency: "$",
    featureListing: { daily: 5, weekly: 25, monthly: 80, yearly: 800 },
    bannerAds: { daily: 10, weekly: 50, monthly: 180, yearly: 1800 },
    packages: { starter: 150, business: 400, premium: 999, enterprise: 2500 },
  }
};

export default function AdPricingControl() {
  const navigate = useNavigate();
  const [activeMarket, setActiveMarket] = useState<"Nigeria" | "China" | "USA">("Nigeria");
  
  // Create deep copy for local edits
  const [pricingData, setPricingData] = useState<Record<string, MarketPricing>>(
    JSON.parse(JSON.stringify(DEFAULT_PRICING))
  );

  const currentPricing = pricingData[activeMarket];

  const handleUpdate = (
    category: "featureListing" | "bannerAds" | "packages",
    key: string,
    value: string
  ) => {
    const numValue = value === "" ? 0 : parseInt(value) || 0;
    setPricingData((prev) => ({
      ...prev,
      [activeMarket]: {
        ...prev[activeMarket],
        [category]: {
          ...prev[activeMarket][category],
          [key]: numValue,
        },
      },
    }));
  };

  const handleSave = () => {
    // API call would go here
    alert(`Successfully saved pricing for ${activeMarket} market!`);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset to default prices?")) {
      setPricingData((prev) => ({
        ...prev,
        [activeMarket]: JSON.parse(JSON.stringify(DEFAULT_PRICING[activeMarket]))
      }));
    }
  };

  const InputField = ({ label, value, category, objKey }: { label: string, value: number, category: any, objKey: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
          {currentPricing.currency}
        </span>
        <input
          type="number"
          value={value || ""}
          onChange={(e) => handleUpdate(category, objKey, e.target.value)}
          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="px-4 py-3 max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Ad Pricing Control</h1>
          </div>
          <span className="text-xs font-semibold bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded">
            Admin Panel
          </span>
        </div>
      </header>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          
          {/* Market Selector */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Market / Region</label>
            <div className="flex flex-wrap gap-2">
              {(["Nigeria", "China", "USA"] as const).map((market) => (
                <button
                  key={market}
                  onClick={() => setActiveMarket(market)}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    activeMarket === market
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {market}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {/* Feature Listing Prices */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 uppercase tracking-wider">
                Feature Listing Prices
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Daily" value={currentPricing.featureListing.daily} category="featureListing" objKey="daily" />
                <InputField label="Weekly" value={currentPricing.featureListing.weekly} category="featureListing" objKey="weekly" />
                <InputField label="Monthly" value={currentPricing.featureListing.monthly} category="featureListing" objKey="monthly" />
                <InputField label="Yearly" value={currentPricing.featureListing.yearly} category="featureListing" objKey="yearly" />
              </div>
            </div>

            {/* Banner Ad Prices */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 uppercase tracking-wider">
                Banner Ad Prices
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Daily" value={currentPricing.bannerAds.daily} category="bannerAds" objKey="daily" />
                <InputField label="Weekly" value={currentPricing.bannerAds.weekly} category="bannerAds" objKey="weekly" />
                <InputField label="Monthly" value={currentPricing.bannerAds.monthly} category="bannerAds" objKey="monthly" />
                <InputField label="Yearly" value={currentPricing.bannerAds.yearly} category="bannerAds" objKey="yearly" />
              </div>
            </div>

            {/* Packages */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 uppercase tracking-wider">
                Packages
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Starter" value={currentPricing.packages.starter} category="packages" objKey="starter" />
                <InputField label="Business" value={currentPricing.packages.business} category="packages" objKey="business" />
                <InputField label="Premium" value={currentPricing.packages.premium} category="packages" objKey="premium" />
                <InputField label="Enterprise" value={currentPricing.packages.enterprise} category="packages" objKey="enterprise" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              className="flex-1 bg-[#22c55e] text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-colors"
            >
              <Save className="w-5 h-5" />
              SAVE CHANGES
            </button>
            <button
              onClick={handleReset}
              className="sm:w-auto w-full bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-gray-500" />
              RESET TO DEFAULT
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
