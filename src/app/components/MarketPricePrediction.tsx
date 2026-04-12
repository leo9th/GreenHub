import { useMemo } from "react";
import { predictMarketPrice } from "../utils/marketPricePrediction";
import { useCurrency } from "../hooks/useCurrency";

type Props = {
  title: string;
  category: string;
  description: string;
  currentPrice: number;
  relatedListingCount?: number;
};

export function MarketPricePrediction({ title, category, description, currentPrice, relatedListingCount }: Props) {
  const formatPrice = useCurrency();
  const { min, max, similarItemCount } = useMemo(
    () =>
      predictMarketPrice({
        productTitle: title,
        category,
        description,
        currentPrice,
        relatedListingCount,
      }),
    [title, category, description, currentPrice, relatedListingCount],
  );

  return (
    <p className="market-prediction" aria-live="polite">
      💡 Based on {similarItemCount} similar items, fair price is {formatPrice(min)} – {formatPrice(max)}
    </p>
  );
}
