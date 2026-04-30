import { OrderUiState, OrderActionType, OrderState as CoreOrderState } from "./OrderState";

export type Action = {
  label: string;
  actionType: OrderActionType;
  disabled: boolean;
  payload?: any;
  variant?: "primary" | "secondary" | "danger";
};

export interface OrderActionsResolved {
  primary: Action | null;
  secondary: Action[];
  passive?: Action[];
}

export function getOrderActions(orderUiState: OrderUiState, isBuyerView: boolean, riderInfo: CoreOrderState['riderInfo'], orderId: string, hasReviewableItems: boolean): OrderActionsResolved {
  const actions: OrderActionsResolved = {
    primary: null,
    secondary: [],
    passive: [{ label: "Back", actionType: "GO_BACK", disabled: false }],
  };

  if (!isBuyerView) {
    // Seller view actions (simplified for now, mostly passive/informational)
    actions.primary = {
      label: "View messages",
      actionType: "MESSAGE_RIDER", // Generic for now, could be MESSAGE_SELLER
      disabled: false,
      payload: { riderId: riderInfo?.id, orderId },
    };
    actions.secondary.push({ label: "Get Help", actionType: "GET_HELP", disabled: false, payload: { orderId } });
    actions.secondary.push({ label: "Refresh", actionType: "REFRESH", disabled: false, payload: { orderId } });
    return actions;
  }

  // Buyer view actions
  switch (orderUiState) {
    case "searching_rider":
      actions.primary = { label: "Cancel Order", actionType: "CANCEL_ORDER", disabled: false, variant: "danger", payload: { orderId } };
      actions.secondary.push(
        { label: "Contact Support", actionType: "GET_HELP", disabled: false, payload: { orderId } },
        { label: "Track Status", actionType: "TRACK_STATUS", disabled: false, payload: { orderId } },
      );
      break;

    case "rider_assigned":
    case "rider_picking_up":
    case "rider_on_the_way":
    case "arriving":
      actions.primary = { label: "Message Rider", actionType: "MESSAGE_RIDER", disabled: false, payload: { riderId: riderInfo?.id, orderId } };
      actions.secondary.push(
        { label: "Call Rider", actionType: "CALL_RIDER", disabled: !riderInfo?.phone, payload: { riderPhone: riderInfo?.phone, orderId } },
        { label: "Get Help", actionType: "GET_HELP", disabled: false, payload: { orderId } },
        { label: "Track Status", actionType: "TRACK_STATUS", disabled: false, payload: { orderId } },
      );
      break;

    case "delivered":
      if (hasReviewableItems) {
        actions.primary = { label: "Rate Order", actionType: "RATE_ORDER", disabled: false, payload: { orderId } };
      }
      actions.secondary.push(
        { label: "Shop Again", actionType: "SHOP_AGAIN", disabled: false, payload: { orderId } },
        { label: "Get Help", actionType: "GET_HELP", disabled: false, payload: { orderId } },
        { label: "Refresh", actionType: "REFRESH", disabled: false, payload: { orderId } },
      );
      break;

    case "cancelled":
      actions.primary = { label: "Shop Again", actionType: "SHOP_AGAIN", disabled: false, payload: { orderId } };
      actions.secondary.push(
        { label: "Get Help", actionType: "GET_HELP", disabled: false, payload: { orderId } },
        { label: "Refresh", actionType: "REFRESH", disabled: false, payload: { orderId } },
      );
      break;

    case "unknown":
    default:
      actions.primary = { label: "Go to Home", actionType: "GO_HOME", disabled: false };
      actions.secondary.push(
        { label: "Get Help", actionType: "GET_HELP", disabled: false, payload: { orderId } },
        { label: "Refresh", actionType: "REFRESH", disabled: false, payload: { orderId } },
      );
      break;
  }

  return actions;
}
