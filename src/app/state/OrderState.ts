export type MarketMode = "c2c" | "b2c";

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EN_ROUTE_TO_PICKUP"
  | "AT_PICKUP"
  | "EN_ROUTE_TO_DROPOFF"
  | "AT_DROPOFF"
  | "DELIVERED"
  | "CANCELLED_BY_RIDER"
  | "CANCELLED_BY_BUYER"
  | "COMPLETED";

export interface RiderInfo {
  id: string;
  name: string;
  vehicle: string;
  plateNumber: string;
  phone: string;
  photoUrl: string;
  /** Shown in tracking UI when set (e.g. future profile aggregate). */
  rating?: number | null;
}

export interface OrderState {
  orderId: string;
  status: OrderStatus;
  /** Marketplace (c2c) vs store / guaranteed warehouse (b2c); same rule as Checkout. */
  marketMode: MarketMode;
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  riderInfo: RiderInfo | null;
  estimatedArrivalTime: string | null; // ISO string or human-readable
  currentRiderLocation: { lat: number; lng: number; bearing: number; lastSeenAt?: string | null } | null;
  // Add other relevant order details as needed
}

export type OrderAction =
  | { type: "RESET_ORDER" }
  | { type: "SET_ORDER_DETAILS"; payload: Partial<Omit<OrderState, "riderInfo" | "currentRiderLocation" | "estimatedArrivalTime">> }
  | { type: "UPDATE_ORDER_STATUS"; status: OrderStatus }
  | { type: "UPDATE_RIDER_INFO"; riderInfo: RiderInfo | null }
  | { type: "UPDATE_ESTIMATED_ARRIVAL_TIME"; time: string | null; } // ISO string or human-readable
  | { type: "UPDATE_RIDER_LOCATION"; lat: number; lng: number; bearing: number | null; lastSeenAt?: string | null }
  | { type: "CLEAR_RIDER_LOCATION" }
  | { type: "INITIATE_REVIEW"; itemId: string; productId: string; orderId: string }
  | { type: "SUBMIT_REVIEW"; rating: number; text: string; isAnonymous: boolean }
  | { type: "CANCEL_REVIEW" }
  | { type: "SUBMIT_ORDER_ACTION"; actionType: OrderActionType; payload?: any };

export type BookingUiState =
  | "idle"
  | "selecting_pickup"
  | "selecting_dropoff"
  | "ready_to_confirm"
  | "confirmed"
  | "arriving"
  | "in_delivery"
  | "delivered";

/** High-level order lifecycle for action engine + headers (not the same as live map tracking stage). */
export type OrderUiState =
  | "searching_rider"
  | "rider_assigned"
  | "rider_picking_up"
  | "rider_on_the_way"
  | "arriving"
  | "delivered"
  | "cancelled"
  | "unknown";

/** Buyer live tracking strip — single source in OrderDetail, updated by server status + map mock signals. */
export type OrderTrackingStage = "searching" | "assigned" | "arriving" | "in_transit" | "delivered";

export type OrderActionType =
  | "CANCEL_ORDER"
  | "MESSAGE_RIDER"
  | "CALL_RIDER"
  | "RATE_ORDER"
  | "SHOP_AGAIN"
  | "GET_HELP"
  | "GO_HOME"
  | "REFRESH"
  | "TRACK_STATUS"
  | "GO_BACK"
  | "SUBMIT_RATING"
  | "CANCEL_REVIEW_RATING";