/** Nigerian Naira — whole naira, grouped per locale. */
export function formatNgn(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}
