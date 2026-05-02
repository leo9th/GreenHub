import { OrderUiState, OrderActionType, OrderState as CoreOrderState } from "../../state/OrderState";
import { getOrderActions } from "../../state/OrderActionEngine";
import { orderTrackBtnDangerPrimaryFull, orderTrackBtnPrimaryFull, orderTrackBtnSecondary } from "./orderTrackingButtonClasses";

export type OrderFooterActionsProps = {
  orderUiState: OrderUiState;
  isBuyerView: boolean;
  riderInfo: CoreOrderState["riderInfo"];
  orderId: string;
  hasReviewableItems: boolean;
  onAction: (actionType: OrderActionType, payload?: unknown) => void;
};

/**
 * Primary + secondary order actions when the live tracking stack is not shown
 * (e.g. delivered, cancelled) — avoids duplicating Call/Message/Support from the tracking bar.
 */
export function OrderFooterActions({
  orderUiState,
  isBuyerView,
  riderInfo,
  orderId,
  hasReviewableItems,
  onAction,
}: OrderFooterActionsProps) {
  const resolved = getOrderActions(orderUiState, isBuyerView, riderInfo, orderId, hasReviewableItems);

  const primaryClassName =
    resolved.primary?.variant === "danger" ? orderTrackBtnDangerPrimaryFull : orderTrackBtnPrimaryFull;

  return (
    <div className="space-y-2">
      {resolved.primary ? (
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <button
            type="button"
            disabled={resolved.primary.disabled}
            onClick={
              resolved.primary.disabled ? undefined : () => onAction(resolved.primary!.actionType, resolved.primary!.payload)
            }
            className={primaryClassName}
          >
            {resolved.primary.label}
          </button>
        </div>
      ) : null}
      {resolved.secondary.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {resolved.secondary.map((action) => (
            <button
              key={action.actionType}
              type="button"
              onClick={() => onAction(action.actionType, action.payload)}
              disabled={action.disabled}
              className={orderTrackBtnSecondary}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
