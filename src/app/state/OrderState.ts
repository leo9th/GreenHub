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
}

export interface OrderState {
  orderId: string;
  status: OrderStatus;
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  riderInfo: RiderInfo | null;
  estimatedArrivalTime: string | null; // ISO string or human-readable
  currentRiderLocation: { lat: number; lng: number; bearing: number } | null;
  // Add other relevant order details as needed
}

export type OrderAction =
  | { type: "RESET_ORDER" }
  | { type: "SET_ORDER_DETAILS"; payload: Partial<Omit<OrderState, "riderInfo" | "currentRiderLocation" | "estimatedArrivalTime">> }
  | { type: "UPDATE_ORDER_STATUS"; status: OrderStatus }
  | { type: "UPDATE_RIDER_INFO"; riderInfo: RiderInfo | null }
  | { type: "UPDATE_ESTIMATED_ARRIVAL_TIME"; time: string | null; } // ISO string or human-readable
  | { type: "UPDATE_RIDER_LOCATION"; lat: number; lng: number; bearing: number | null }
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