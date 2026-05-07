import type { RideVehicleTier } from "./vehicleTiers";
import { haversineKm } from "./distance";

const BASE_NGN = 1500;
const PER_KM_NGN = 320;

export const RIDE_TIER_MULTIPLIER: Record<RideVehicleTier, number> = {
  bike: 0.55,
  economy: 1,
  comfort: 1.15,
  xl: 1.35,
  premium: 1.55,
};

export function estimateRideFareNgn(distanceKm: number, tier: RideVehicleTier): number {
  const raw = (BASE_NGN + distanceKm * PER_KM_NGN) * RIDE_TIER_MULTIPLIER[tier];
  return Math.max(0, Math.round(raw));
}

export function distanceKmBetween(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): number {
  return haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
}
