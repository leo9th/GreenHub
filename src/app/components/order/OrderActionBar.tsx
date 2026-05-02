import { HelpCircle, MessageCircle, Phone, XCircle } from "@/app/icons/emojiLucide";
import type { OrderActionType } from "../../state/OrderState";
import type { OrderTrackingStage } from "../../state/OrderState";
import type { RiderInfo } from "../../state/OrderState";
import { cn } from "../ui/utils";
import { orderTrackBtnDangerOutline, orderTrackBtnPrimaryFull, orderTrackBtnSecondary, orderTrackIconSm } from "./orderTrackingButtonClasses";

export type OrderActionBarProps = {
  stage: OrderTrackingStage;
  rider: RiderInfo | null;
  orderId: string;
  onAction: (actionType: OrderActionType, payload?: unknown) => void;
  className?: string;
};

type PrimaryAction = "call" | "message" | "support";

function resolvePrimary(showRiderActions: boolean, rider: RiderInfo | null): PrimaryAction {
  if (showRiderActions && rider?.phone?.trim()) return "call";
  if (showRiderActions && rider?.id) return "message";
  return "support";
}

const secondaryBtnClass = cn(orderTrackBtnSecondary, "lg:w-full lg:flex-none");

export function OrderActionBar({ stage, rider, orderId, onAction, className }: OrderActionBarProps) {
  const showRiderActions = Boolean(rider);
  const showCancel = stage === "searching" || stage === "assigned";
  const primary = resolvePrimary(showRiderActions, rider);

  return (
    <div className={cn("border-t border-slate-100 bg-slate-50/90 p-4 md:p-5", className)}>
      <div className="flex flex-col gap-2 md:gap-3">
        {primary === "call" ? (
          <button
            type="button"
            onClick={() => onAction("CALL_RIDER", { riderPhone: rider?.phone, orderId })}
            disabled={!rider?.phone}
            className={orderTrackBtnPrimaryFull}
          >
            <Phone className={`${orderTrackIconSm} text-white/95`} aria-hidden />
            Call rider
          </button>
        ) : null}

        {primary === "message" ? (
          <button
            type="button"
            onClick={() => onAction("MESSAGE_RIDER", { riderId: rider?.id, orderId })}
            disabled={!rider?.id}
            className={orderTrackBtnPrimaryFull}
          >
            <MessageCircle className={`${orderTrackIconSm} text-white/95`} aria-hidden />
            Message rider
          </button>
        ) : null}

        {primary === "support" ? (
          <button type="button" onClick={() => onAction("GET_HELP", { orderId })} className={orderTrackBtnPrimaryFull}>
            <HelpCircle className={`${orderTrackIconSm} text-white/95`} aria-hidden />
            Support
          </button>
        ) : null}

        {(() => {
          const showSecondaryCall = primary !== "call" && showRiderActions;
          const showSecondaryMessage = primary !== "message" && showRiderActions;
          const showSecondarySupport = primary !== "support";
          if (!showSecondaryCall && !showSecondaryMessage && !showSecondarySupport && !showCancel) return null;
          return (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col lg:gap-2">
              {showSecondaryCall ? (
                <button
                  type="button"
                  onClick={() => onAction("CALL_RIDER", { riderPhone: rider?.phone, orderId })}
                  disabled={!rider?.phone}
                  className={secondaryBtnClass}
                >
                  <Phone className={`${orderTrackIconSm} text-emerald-600`} aria-hidden />
                  Call
                </button>
              ) : null}
              {showSecondaryMessage ? (
                <button
                  type="button"
                  onClick={() => onAction("MESSAGE_RIDER", { riderId: rider?.id, orderId })}
                  disabled={!rider?.id}
                  className={secondaryBtnClass}
                >
                  <MessageCircle className={`${orderTrackIconSm} text-emerald-600`} aria-hidden />
                  Message
                </button>
              ) : null}
              {showSecondarySupport ? (
                <button type="button" onClick={() => onAction("GET_HELP", { orderId })} className={secondaryBtnClass}>
                  <HelpCircle className={`${orderTrackIconSm} text-sky-600`} aria-hidden />
                  Support
                </button>
              ) : null}
              {showCancel ? (
                <button
                  type="button"
                  onClick={() => onAction("CANCEL_ORDER", { orderId })}
                  className={cn(orderTrackBtnDangerOutline, "lg:w-full lg:flex-none")}
                >
                  <XCircle className={orderTrackIconSm} aria-hidden />
                  Cancel
                </button>
              ) : null}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
