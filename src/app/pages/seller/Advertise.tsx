import { useState } from "react";
import { ArrowLeft, CheckCircle2, TrendingUp, ImageIcon, Crown, CreditCard, Building2, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useCurrency } from "../../hooks/useCurrency";
import { useRegion } from "../../context/RegionContext";
import { PaystackButton } from "react-paystack";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

export default function Advertise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId");
  const formatPrice = useCurrency();
  const { activeRegion } = useRegion();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"feature" | "banner" | "package">("feature");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"plan" | "payment">("plan");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [isProcessing, setIsProcessing] = useState(false);

  // Scaled mock pricing based on region
  const scale = activeRegion.id === "US" ? 0.002 : activeRegion.id === "CN" ? 0.015 : 1;
  
  const featurePlans = [
    { id: "f-daily", name: "Daily Boost", price: 500 * scale, duration: "24 Hours", features: ["Top of search results", "Highlighted badge"] },
    { id: "f-weekly", name: "Weekly Boost", price: 3000 * scale, duration: "7 Days", features: ["Top of search results", "Highlighted badge", "Homepage placement"] },
    { id: "f-monthly", name: "Monthly Pro", price: 10000 * scale, duration: "30 Days", features: ["Top of search results", "Highlighted badge", "Homepage placement", "Priority support"] },
    { id: "f-yearly", name: "Yearly Elite", price: 100000 * scale, duration: "365 Days", features: ["Always on top", "Exclusive badge", "Homepage placement", "Dedicated account manager"] },
  ];

  const bannerPlans = [
    { id: "b-daily", name: "Daily Banner", price: 1000 * scale, duration: "24 Hours" },
    { id: "b-weekly", name: "Weekly Banner", price: 6000 * scale, duration: "7 Days" },
    { id: "b-monthly", name: "Monthly Banner", price: 20000 * scale, duration: "30 Days" },
    { id: "b-yearly", name: "Yearly Banner", price: 200000 * scale, duration: "365 Days" },
  ];

  const packages = [
    { id: "p-starter", name: "Starter", price: 25000 * scale, duration: "Monthly", features: ["5 Featured Listings", "1 Week Banner Ad", "Store Verification"] },
    { id: "p-business", name: "Business", price: 75000 * scale, duration: "Quarterly", features: ["20 Featured Listings", "1 Month Banner Ad", "Store Verification", "Analytics Dashboard"] },
    { id: "p-premium", name: "Premium", price: 200000 * scale, duration: "Semi-Annual", features: ["Unlimited Featured Listings", "3 Months Banner Ad", "Store Verification", "API Access"] },
    { id: "p-enterprise", name: "Enterprise", price: 500000 * scale, duration: "Yearly", features: ["Unlimited Everything", "Year-round Home Banner", "Dedicated Manager", "Zero Platform Fees"] },
  ];

  const handleSubscribe = () => {
    if (!selectedPlan) return;
    if (checkoutStep === "plan") {
      setCheckoutStep("payment");
      window.scrollTo(0, 0);
    }
  };

  const totalPrice = [...featurePlans, ...bannerPlans, ...packages].find(p => p.id === selectedPlan)?.price || 0;

  const paystackProps = {
    email: user?.email || "seller@greenhub.com",
    amount: totalPrice * 100, // in kobo
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    text: "Complete Payment",
    onSuccess: () => {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        toast.success("Ads successfully boosted!");
        const nextUrl = productId 
          ? `/seller/advertise/setup?plan=${selectedPlan}&productId=${productId}`
          : `/seller/advertise/setup?plan=${selectedPlan}`;
        navigate(nextUrl);
      }, 1000);
    },
    onClose: () => {
      toast.error("Payment cancelled.");
    },
  };

  const PlanCard = ({ plan, icon: Icon }: { plan: any, icon: any }) => (
    <div 
      onClick={() => {
        setSelectedPlan(plan.id);
        // Automatically proceed after a short delay so they can see the checkmark
        setTimeout(() => {
          setCheckoutStep("payment");
          window.scrollTo(0, 0);
        }, 600);
      }}
      className={`relative p-6 rounded-2xl border-2 flex flex-col cursor-pointer transition-all ${
        selectedPlan === plan.id 
          ? "border-[#22c55e] bg-green-50 shadow-md transform scale-[1.02]" 
          : "border-gray-200 bg-white hover:border-[#22c55e]/50 hover:shadow-sm"
      }`}
    >
      {selectedPlan === plan.id && (
        <div className="absolute top-4 right-4 text-[#22c55e]">
          <CheckCircle2 className="w-6 h-6 fill-current text-white" />
        </div>
      )}
      
      <div className="w-12 h-12 bg-[#22c55e]/10 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#22c55e]" />
      </div>
      
      <div className="flex items-end gap-2 mb-2">
        <h3 className="text-2xl font-bold text-gray-900">{formatPrice(plan.price)}</h3>
        <span className="text-gray-500 text-sm mb-1">/ {plan.duration}</span>
      </div>
      
      <h4 className="text-lg font-semibold text-gray-800 mb-4">{plan.name}</h4>
      
      {plan.features && (
        <ul className="space-y-3 mb-6">
          {plan.features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}
      
      <div className="mt-auto pt-4">
        {selectedPlan !== plan.id ? (
          <button className="w-full py-2.5 rounded-xl font-bold text-[#22c55e] border-2 border-[#22c55e] hover:bg-[#22c55e] hover:text-white transition-colors">
            Select Plan
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); setCheckoutStep("payment"); window.scrollTo(0, 0); }}
            className="w-full py-2.5 bg-[#22c55e] text-white rounded-xl font-bold hover:bg-[#16a34a] transition-colors shadow-sm"
          >
            Continue to Payment
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => checkoutStep === "payment" ? setCheckoutStep("plan") : navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Boost Your Sales</h1>
            <p className="text-xs text-gray-500">Subscribe for Advertisements</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        
        {checkoutStep === "plan" ? (
          <>
            {/* Tabs */}
            <div className="flex bg-gray-200/50 p-1 rounded-xl mb-8 overflow-x-auto no-scrollbar">
              <button
                onClick={() => { setActiveTab("feature"); setSelectedPlan(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm text-center transition-all whitespace-nowrap ${
                  activeTab === "feature" ? "bg-white text-[#22c55e] shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <TrendingUp className="w-4 h-4 inline-block mr-2 md:mb-1" />
                <span className="hidden md:inline">Feature </span>Listing
              </button>
              <button
                onClick={() => { setActiveTab("banner"); setSelectedPlan(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm text-center transition-all whitespace-nowrap ${
                  activeTab === "banner" ? "bg-white text-[#22c55e] shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ImageIcon className="w-4 h-4 inline-block mr-2 md:mb-1" />
                Banner Ads
              </button>
              <button
                onClick={() => { setActiveTab("package"); setSelectedPlan(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm text-center transition-all whitespace-nowrap ${
                  activeTab === "package" ? "bg-white text-[#22c55e] shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Crown className="w-4 h-4 inline-block mr-2 md:mb-1" />
                Pro Packages
              </button>
            </div>

            {/* Content */}
            <div className="mb-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {activeTab === "feature" && "Sell up to 10x faster"}
                  {activeTab === "banner" && "Massive Homepage Visibility"}
                  {activeTab === "package" && "All-in-One Professional Store"}
                </h2>
                <p className="text-gray-600 text-sm">
                  {activeTab === "feature" && "Highlight your existing product listings so they appear at the very top of buyer searches."}
                  {activeTab === "banner" && "Upload a custom promotional banner to be displayed on the Main Homepage carousel."}
                  {activeTab === "package" && "Bundle your ad spending and get premium seller tools to manage bulk sales efficiently."}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {activeTab === "feature" && featurePlans.map(plan => <PlanCard key={plan.id} plan={plan} icon={TrendingUp} />)}
                {activeTab === "banner" && bannerPlans.map(plan => <PlanCard key={plan.id} plan={plan} icon={ImageIcon} />)}
                {activeTab === "package" && packages.map(plan => <PlanCard key={plan.id} plan={plan} icon={Crown} />)}
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Select Payment Method</h2>
              <div className="space-y-4">
                {/* Card Payment */}
                <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === "card" ? "border-[#22c55e] bg-green-50" : "border-gray-200"}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                    className="w-5 h-5 text-[#22c55e]"
                  />
                  <CreditCard className="w-8 h-8 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">Card Payment</p>
                    <p className="text-sm text-gray-500">Pay securely with Debit/Credit Card</p>
                  </div>
                  <img src="https://paystack.com/assets/images/logo/logo.svg" alt="Paystack" className="h-5" />
                </label>

                {/* Bank Transfer */}
                <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === "bank" ? "border-[#22c55e] bg-green-50" : "border-gray-200"}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "bank"}
                    onChange={() => setPaymentMethod("bank")}
                    className="w-5 h-5 text-[#22c55e]"
                  />
                  <Building2 className="w-8 h-8 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">Bank Transfer</p>
                    <p className="text-sm text-gray-500">Direct transfer to our account</p>
                  </div>
                </label>
              </div>

              {/* Explicit Payment CTA Button */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                   <p className="text-gray-600 font-medium">Total Amount</p>
                   <p className="text-2xl font-bold text-[#22c55e]">{formatPrice(totalPrice)}</p>
                </div>
                {paymentMethod === 'card' ? (
                  <PaystackButton
                    {...paystackProps}
                    className="w-full bg-[#092b23] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#061d18] transition-colors shadow-lg flex items-center justify-center gap-2"
                  />
                ) : (
                  <button className="w-full bg-[#22c55e] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#16a34a] transition-colors shadow-lg">
                    Confirm Bank Transfer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Checkout Bar - Only for Plan Selection Step */}
      {selectedPlan && checkoutStep === "plan" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 animate-in slide-in-from-bottom-5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Selected Plan</p>
              <p className="font-bold text-gray-900">
                {formatPrice(totalPrice)}
              </p>
            </div>
            <button
              onClick={handleSubscribe}
              className="bg-[#22c55e] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#16a34a] transition-colors shadow-sm"
            >
              Continue to Payment
            </button>
          </div>
        </div>
      )}
    {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-200 shadow-2xl">
            <Loader2 className="w-12 h-12 text-[#22c55e] animate-spin mx-auto" />
            <h3 className="text-xl font-bold text-gray-900">Processing Payment...</h3>
            <p className="text-gray-500 text-sm">Please do not close this window</p>
          </div>
        </div>
      )}
    </div>
  );
}
