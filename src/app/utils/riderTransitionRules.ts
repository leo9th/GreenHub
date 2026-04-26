export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "rejected";

export type ProductRideStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "en_route"
  | "delivered"
  | "cancelled"
  | "failed"
  | "rejected";

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return true;
  const allowed: Record<DeliveryStatus, DeliveryStatus[]> = {
    pending: ["assigned"],
    assigned: ["picked_up", "rejected"],
    picked_up: ["delivered"],
    delivered: [],
    cancelled: [],
    rejected: ["assigned"],
  };
  return allowed[from].includes(to);
}

export function canTransitionProductRide(from: ProductRideStatus, to: ProductRideStatus): boolean {
  if (from === to) return true;
  const allowed: Record<ProductRideStatus, ProductRideStatus[]> = {
    pending: ["assigned"],
    assigned: ["accepted", "rejected"],
    accepted: ["en_route", "rejected"],
    en_route: ["delivered"],
    delivered: [],
    cancelled: [],
    failed: [],
    rejected: [],
  };
  return allowed[from].includes(to);
}

export function canRiderMutateAssigned(assignedRiderId: string | null, currentUserId: string | null): boolean {
  if (!assignedRiderId || !currentUserId) return false;
  return assignedRiderId === currentUserId;
}
