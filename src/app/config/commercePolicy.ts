export type KycStrictness = "light" | "balanced" | "strict";
export type MarketMode = "b2c" | "c2c";
export type SupportChannel = "chat" | "whatsapp" | "phone" | "email";

export type CommercePolicy = {
  kycStrictness: KycStrictness;
  c2cAutoReviewThresholdNgn: number;
  newSellerPayoutHoldDays: number;
  newRiderPayoutHoldDays: number;
  supportChannelPriority: SupportChannel[];
  goLiveModeTarget: {
    b2cPercent: number;
    c2cPercent: number;
  };
};

export const commercePolicy: CommercePolicy = {
  kycStrictness: "balanced",
  c2cAutoReviewThresholdNgn: 250000,
  newSellerPayoutHoldDays: 7,
  newRiderPayoutHoldDays: 7,
  supportChannelPriority: ["whatsapp", "chat", "phone", "email"],
  goLiveModeTarget: {
    b2cPercent: 60,
    c2cPercent: 40,
  },
};
