import { OrderUiState, OrderActionType, OrderState as CoreOrderState } from "../../state/OrderState";
import { getOrderActions } from "../../state/OrderActionEngine";

export type OrderActionBarProps = {
  orderUiState: OrderUiState;
  isBuyerView: boolean;
  riderInfo: CoreOrderState['riderInfo'];
  orderId: string;
  hasReviewableItems: boolean;
  onAction: (actionType: OrderActionType, payload?: any) => void;
};

export function OrderActionBar({ orderUiState, isBuyerView, riderInfo, orderId, hasReviewableItems, onAction }: OrderActionBarProps) {
  const resolvedActions = getOrderActions(orderUiState, isBuyerView, riderInfo, orderId, hasReviewableItems);
  const primaryAction = resolvedActions.primary;

  if (!primaryAction) return null;

  return (
    <div className="bg-white rounded-lg p-4">
      <button
        type="button"
        disabled={primaryAction.disabled}
        onClick={primaryAction.disabled ? undefined : () => onAction(primaryAction.actionType, primaryAction.payload)}
        className="w-full py-3 bg-[#22c55e] text-white rounded-lg font-semibold text-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {primaryAction.label}
      </button>
    </div>
  );
}
