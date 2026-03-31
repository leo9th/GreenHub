import { useRegion } from "../context/RegionContext";
import { formatCurrency } from "../utils/formatCurrency";

export function useCurrency() {
  const { activeRegion } = useRegion();
  
  const formatPrice = (amount: number) => {
    // Simulated realtime conversion for the static hardcoded NGN amounts across the app
    const mult = activeRegion.id === "US" ? 0.00065 : activeRegion.id === "CN" ? 0.0047 : 1;
    return formatCurrency(amount * mult, activeRegion.currencyCode);
  };

  return formatPrice;
}
