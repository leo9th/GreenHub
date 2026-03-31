export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (e) {
    // Fallback simple formatter if currency code is unrecognised
    return `${currencyCode} ${amount.toLocaleString()}`;
  }
}
