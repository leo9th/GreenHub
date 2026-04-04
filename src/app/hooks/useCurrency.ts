import { useRegion } from "../context/RegionContext";
import { formatCurrency } from "../utils/formatCurrency";

export function useCurrency() {
  const { activeRegion } = useRegion();
  
  const formatPrice = (amount: number | null | undefined) => {
    const n = amount == null || !Number.isFinite(Number(amount)) ? 0 : Number(amount);
    // Simulated realtime conversion for the static hardcoded NGN amounts across the app
    const mult = activeRegion.id === "US" ? 0.00065 : activeRegion.id === "CN" ? 0.0047 : 1;
    return formatCurrency(n * mult, activeRegion.currencyCode);
  };

  return formatPrice;
}
