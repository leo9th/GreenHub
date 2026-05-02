import type { OrderStatus } from "../state/OrderState";

/**
 * GreenHub-managed rider delivery (Option A) — canonical rules and UI labels.
 *
 * ## When a `delivery_jobs` row is created (server trigger)
 * - **Create:** when `orders.status` becomes **`paid`** (insert-as-paid or transition to paid).
 * - **Not created on:** `pending_payment` (e.g. Pay on delivery at checkout) until the order is
 *   actually **`paid`**. Seller-arranged fulfillment is unchanged; the job is logistics metadata only.
 * - **Idempotent:** at most one job per `orders.id` (`delivery_jobs.order_id` unique).
 *
 * ## When a job is cancelled (server trigger)
 * - **Cancel** open jobs when `orders.status` moves to **`cancelled`**, **`refunded`**, or **`failed`**
 *   (terminal non-fulfillment states used elsewhere in the app).
 *
 * ## Role → UI mapping (job `status`)
 * - **Buyer:** milestone copy + handoff PIN (show only to buyer in UI). Track on order detail.
 * - **Seller:** read-only milestones + pickup summary; no rider controls. Seller still updates line
 *   items / tracking as today when they arrange their own carrier.
 * - **Rider (assigned):** inbox → accept → pickup → en route → delivered (PIN at delivery).
 * - **Admin:** dispatch console — list jobs, assign/reassign riders, approve rider applications.
 */

export const DELIVERY_JOB_STATUSES = [
  "pending_dispatch",
  "assigned",
  "accepted",
  "arrived_pickup",
  "picked_up",
  "en_route",
  "delivered",
  "failed",
  "cancelled",
] as const;

export type DeliveryJobStatus = (typeof DELIVERY_JOB_STATUSES)[number];

export function isPaidOrderForDeliveryJob(orderStatus: string | null | undefined): boolean {
  return String(orderStatus || "").toLowerCase() === "paid";
}

/** Order statuses that cancel an in-flight delivery job (aligned with checkout / orders UI). */
export function orderStatusCancelsDeliveryJob(orderStatus: string | null | undefined): boolean {
  const s = String(orderStatus || "").toLowerCase();
  return s === "cancelled" || s === "refunded" || s === "failed";
}

export function deliveryJobStatusLabel(status: string | null | undefined): string {
  const s = String(status || "").toLowerCase();
  const map: Record<string, string> = {
    pending_dispatch: "Queued for dispatch",
    assigned: "Rider assigned — awaiting acceptance",
    accepted: "Rider accepted",
    arrived_pickup: "At pickup",
    picked_up: "Picked up",
    en_route: "On the way",
    delivered: "Delivered",
    failed: "Delivery failed",
    cancelled: "Cancelled",
  };
  return map[s] || (s ? s.replace(/_/g, " ") : "Unknown");
}

/** Buyer-facing short milestone for order detail card. */
export function buyerDeliverySummary(status: string | null | undefined): string {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "Your GreenHub rider marked this order as delivered.";
  if (s === "cancelled" || s === "failed") return "GreenHub delivery is not active for this order.";
  if (s === "pending_dispatch") return "A rider will be assigned shortly.";
  if (s === "assigned") return "A rider has been assigned and should accept the job soon.";
  if (s === "accepted" || s === "arrived_pickup") return "The rider is heading to the seller for pickup.";
  if (s === "picked_up" || s === "en_route") return "Your package is on the way to you.";
  return deliveryJobStatusLabel(s);
}

/** Seller-facing copy (read-only logistics). */
export function sellerDeliverySummary(status: string | null | undefined): string {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "GreenHub rider completed delivery to the buyer.";
  if (s === "cancelled" || s === "failed") return "GreenHub rider delivery was cancelled or failed.";
  if (!s || s === "pending_dispatch") return "GreenHub is preparing rider dispatch for this order.";
  return `Rider status: ${deliveryJobStatusLabel(s)}`;
}

/** Maps `delivery_jobs.status` to buyer/seller courier UI state (OrderDetail map + panels). */
export function mapDeliveryJobStatusToOrderStatus(jobStatus: string | null | undefined): OrderStatus {
  const s = String(jobStatus || "").toLowerCase();
  switch (s) {
    case "pending_dispatch":
    case "assigned":
      return "PENDING";
    case "accepted":
      return "ACCEPTED";
    case "arrived_pickup":
      return "EN_ROUTE_TO_PICKUP";
    case "picked_up":
      return "AT_PICKUP";
    case "en_route":
      return "EN_ROUTE_TO_DROPOFF";
    case "delivered":
      return "DELIVERED";
    case "failed":
      return "CANCELLED_BY_RIDER";
    case "cancelled":
      return "CANCELLED_BY_BUYER";
    default:
      return "PENDING";
  }
}

/**
 * Single source for OrderDetail rider strip: prefer terminal order row, else live job, else paid → searching.
 */
export function resolveCourierUiStatusFromOrderAndJob(
  orderStatusRaw: string | null | undefined,
  job: { status: string } | null,
): OrderStatus {
  const o = String(orderStatusRaw || "").toLowerCase();
  if (o === "delivered" || o === "completed") return "DELIVERED";
  if (o === "cancelled" || o === "refunded" || o === "failed") return "CANCELLED_BY_BUYER";
  if (job) return mapDeliveryJobStatusToOrderStatus(job.status);
  if (o === "paid" || o === "pending" || o === "pending_payment" || o === "processing") return "PENDING";
  return "PENDING";
}
