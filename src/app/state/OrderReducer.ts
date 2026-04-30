import { OrderState, OrderAction, OrderStatus } from "./OrderState";

export const initialOrderState: OrderState = {
  orderId: "",
  status: "PENDING",
  pickupLocation: { lat: 0, lng: 0, address: "" },
  dropoffLocation: { lat: 0, lng: 0, address: "" },
  riderInfo: null,
  estimatedArrivalTime: null,
  currentRiderLocation: null,
};

export function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case "RESET_ORDER":
      return initialOrderState;
    case "SET_ORDER_DETAILS":
      return { ...state, ...action.payload, orderId: action.payload.orderId || "" };
    case "UPDATE_ORDER_STATUS":
      return { ...state, status: action.status };
    case "UPDATE_RIDER_INFO":
      return { ...state, riderInfo: action.riderInfo };
    case "UPDATE_ESTIMATED_ARRIVAL_TIME":
      return { ...state, estimatedArrivalTime: action.time };
      case "UPDATE_RIDER_LOCATION":
        return {
          ...state,
          currentRiderLocation: action.lat != null && action.lng != null && action.bearing != null
            ? { lat: action.lat, lng: action.lng, bearing: action.bearing }
            : null,
        };
      case "INITIATE_REVIEW":
        // State for review modal should probably be in OrderDetail local state
        return state;
      case "SUBMIT_REVIEW":
        // Review submission is a side effect, not a state change in the reducer
        return state;
      case "CANCEL_REVIEW":
        // Review cancellation is a side effect, not a state change in the reducer
        return state;
      case "SUBMIT_ORDER_ACTION":
        // Order actions are side effects, not a state change in the reducer
        return state;
    default:
      return state;
  }
}
