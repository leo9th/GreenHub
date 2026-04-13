type Props = {
  ratingLabel?: string;
  percentileNote?: string;
  className?: string;
};

/** Placeholder insights — connect to real analytics later. */
export function PriceIntelligence({
  ratingLabel = "Fair price range",
  percentileNote = "Compared to similar active listings on GreenHub.",
  className = "",
}: Props) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2 text-xs text-gray-600 ${className}`}>
      <p className="font-semibold text-gray-800">{ratingLabel}</p>
      <p className="mt-1 text-gray-500">{percentileNote}</p>
    </div>
  );
}
