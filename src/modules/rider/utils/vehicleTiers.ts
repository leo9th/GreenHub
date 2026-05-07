/** Passenger ride tiers shown to buyers (maps / pricing / Supabase `vehicle_tier`). */
export type RideVehicleTier = "bike" | "economy" | "comfort" | "xl" | "premium";

export type VehicleTierOption = {
  id: RideVehicleTier;
  label: string;
  seats: number;
  etaLabel: string;
  description: string;
};

/** Ordered from lightest / lowest typical fare to XL / premium. */
export const VEHICLE_TIER_OPTIONS: readonly VehicleTierOption[] = [
  {
    id: "bike",
    label: "Bike",
    seats: 1,
    etaLabel: "2–5 min",
    description: "Quick solo trips on two wheels",
  },
  {
    id: "economy",
    label: "Economy",
    seats: 4,
    etaLabel: "3–6 min",
    description: "Affordable everyday rides",
  },
  {
    id: "comfort",
    label: "Comfort",
    seats: 4,
    etaLabel: "4–7 min",
    description: "Extra space and comfort",
  },
  {
    id: "xl",
    label: "XL",
    seats: 6,
    etaLabel: "5–9 min",
    description: "Groups and extra luggage",
  },
  {
    id: "premium",
    label: "Premium",
    seats: 4,
    etaLabel: "3–8 min",
    description: "Top-tier vehicles and service",
  },
] as const;

export function isRideVehicleTier(v: string): v is RideVehicleTier {
  return v === "bike" || v === "economy" || v === "comfort" || v === "xl" || v === "premium";
}

/** When routing from legacy bike/car entry points, pick a default tier. */
export function defaultTierFromLegacyRideType(rideType: unknown): RideVehicleTier {
  if (rideType === "bike") return "bike";
  return "economy";
}
