/** Primary emails that receive complimentary listing boosts (must match Supabase Auth email). */
const AUTO_ADS_SUBSCRIBER_EMAILS = new Set<string>(["liondecafe@gmail.com"]);

export function isAutoAdsSubscriberEmail(email: string | null | undefined): boolean {
  const e = String(email ?? "")
    .trim()
    .toLowerCase();
  return e.length > 0 && AUTO_ADS_SUBSCRIBER_EMAILS.has(e);
}
