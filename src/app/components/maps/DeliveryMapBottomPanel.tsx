type DeliveryStatusKey = "rider_on_the_way" | "picked_up_item" | "arriving_soon";

type DeliveryMapBottomPanelProps = {
  riderName: string;
  vehicleType: "bike" | "car";
  etaText: string;
  status: DeliveryStatusKey;
  visible?: boolean;
};

const STATUS_LABELS: Record<DeliveryStatusKey, string> = {
  rider_on_the_way: "Rider on the way",
  picked_up_item: "Picked up item",
  arriving_soon: "Arriving soon",
};

export default function DeliveryMapBottomPanel({
  riderName,
  vehicleType,
  etaText,
  status,
  visible = false,
}: DeliveryMapBottomPanelProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-3 bottom-3 z-20 transition-all duration-250 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="rounded-2xl border border-white/75 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{riderName}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {vehicleType === "bike" ? "Bike" : "Car"} rider
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{etaText}</div>
        </div>
        <p className="mt-2 text-sm font-medium text-gray-700">{STATUS_LABELS[status]}</p>
      </div>
    </div>
  );
}
