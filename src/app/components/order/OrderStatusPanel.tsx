import type { RiderInfo, OrderTrackingStage } from "../../state/OrderState";
import { cn } from "../ui/utils";

export type OrderStatusPanelProps = {
  stage: OrderTrackingStage;
  rider: RiderInfo | null;
  estimatedArrivalTime?: string | null;
  /** Merged onto the root (e.g. split-layout border tweaks). */
  className?: string;
};

export function trackingStageHeadline(stage: OrderTrackingStage): string {
  switch (stage) {
    case "searching":
      return "Finding a driver…";
    case "assigned":
      return "Driver assigned";
    case "arriving":
      return "Driver arriving…";
    case "in_transit":
      return "On the way to drop-off";
    case "delivered":
      return "Delivered";
    default:
      return "Tracking";
  }
}

function stageSubline(stage: OrderTrackingStage): string {
  switch (stage) {
    case "searching":
      return "We're matching you with a nearby rider.";
    case "assigned":
      return "Your driver is heading to the pickup point.";
    case "arriving":
      return "Your driver is almost at pickup.";
    case "in_transit":
      return "Package picked up — en route to you.";
    case "delivered":
      return "Your order has reached the destination.";
    default:
      return "";
  }
}

function formatRating(r: number): string {
  if (!Number.isFinite(r)) return "";
  const clamped = Math.min(5, Math.max(0, r));
  return clamped % 1 === 0 ? String(clamped) : clamped.toFixed(1);
}

function ratingStarsText(rating: number): string {
  const clamped = Math.min(5, Math.max(0, rating));
  const full = Math.round(clamped);
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`;
}

export function OrderStatusPanel({ stage, rider, estimatedArrivalTime, className }: OrderStatusPanelProps) {
  const rating = rider?.rating;
  const showRating = rating != null && Number.isFinite(rating) && rating > 0;
  const starsLabel = showRating ? ratingStarsText(rating!) : "";

  return (
    <div
      className={cn(
        "bg-white px-4 py-4 md:px-5 md:py-5 lg:pt-4",
        className,
      )}
    >
      <div className="space-y-4 md:space-y-5">
        <header className="space-y-1">
          <p className="text-base font-semibold leading-snug text-slate-900">{trackingStageHeadline(stage)}</p>
          <p className="text-sm leading-relaxed text-slate-600">{stageSubline(stage)}</p>
        </header>

        {rider ? (
          <div className="flex gap-3 rounded-lg bg-slate-50/90 p-3 ring-1 ring-slate-100/90">
            {rider.photoUrl ? (
              <img src={rider.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200/90 text-sm font-semibold text-slate-700 ring-2 ring-white shadow-sm">
                {rider.name?.charAt(0) ?? "—"}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold text-slate-900">{rider.name}</p>
              <p className="text-sm leading-snug text-slate-600">
                <span className="font-medium text-slate-700">{rider.vehicle}</span>
                {rider.plateNumber && rider.plateNumber !== "—" ? (
                  <span className="text-slate-500">
                    {" "}
                    · <span className="font-mono tabular-nums">{rider.plateNumber}</span>
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        ) : null}

        {showRating ? (
          <div
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            aria-label={`Rider rating ${formatRating(rating!)} out of 5`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rider rating</span>
            <span className="text-sm tabular-nums tracking-tight text-amber-600" aria-hidden>
              {starsLabel}
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-800">
              {formatRating(rating!)}
              <span className="font-medium text-slate-500">/5</span>
            </span>
          </div>
        ) : null}

        {estimatedArrivalTime ? (
          <div className="inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-sky-100 bg-sky-50/90 px-3 py-2 ring-1 ring-sky-100/60">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">Estimated arrival</span>
            <span className="text-sm font-semibold text-sky-950">{estimatedArrivalTime}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
