/**
 * Public social profile URLs for GreenHub (Contact page, footer, etc.).
 * Set any value to `""` to hide that network wherever `getActiveSocialLinks` is used.
 */
export const socialUrls = {
  twitter: "https://twitter.com/greenhubng",
  instagram: "https://instagram.com/greenhub.ng",
  linkedin: "https://linkedin.com/company/greenhub",
  facebook: "https://facebook.com/greenhubng",
} as const;

export type SocialNetworkId = keyof typeof socialUrls;

export type SocialLinkItem = {
  id: SocialNetworkId;
  label: string;
  emoji: string;
  url: string;
};

const SOCIAL_META: readonly { id: SocialNetworkId; label: string; emoji: string }[] = [
  { id: "twitter", label: "Twitter", emoji: "𝕏" },
  { id: "instagram", label: "Instagram", emoji: "📷" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼" },
  { id: "facebook", label: "Facebook", emoji: "📘" },
];

/** Display order on the Contact page. URLs come only from `socialUrls`. */
export const socialLinkItems: SocialLinkItem[] = SOCIAL_META.map((m) => ({
  ...m,
  url: socialUrls[m.id],
}));

/** Links with a non-empty URL (trimmed). */
export function getActiveSocialLinks(items: SocialLinkItem[] = socialLinkItems): SocialLinkItem[] {
  return items.filter((item) => item.url.trim().length > 0);
}
