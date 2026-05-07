import { memo, useMemo } from "react";
import {
  estimateRideFareNgn,
  formatNgn,
  type RideVehicleTier,
  type VehicleTierOption,
  VEHICLE_TIER_OPTIONS,
} from "../../../../modules/rider";

type Props = {
  distanceKm: number | null;
  vehicleTier: RideVehicleTier;
  onSelectTier: (id: RideVehicleTier) => void;
};

function TierChip({
  ride,
  distanceKm,
  selected,
  onSelect,
}: {
  ride: VehicleTierOption;
  distanceKm: number | null;
  selected: boolean;
  onSelect: (id: RideVehicleTier) => void;
}) {
  const ridePrice = useMemo(
    () => (distanceKm == null ? null : estimateRideFareNgn(distanceKm, ride.id)),
    [distanceKm, ride.id],
  );
  return (
    <button
      type="button"
      onClick={() => onSelect(ride.id)}
      className={`shrink-0 snap-start rounded-2xl border px-3 py-2.5 text-left transition ${
        selected
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <p className="text-xs font-semibold text-gray-900">{ride.label}</p>
      <p className="mt-0.5 text-[11px] font-bold text-emerald-700">{ridePrice == null ? "—" : formatNgn(ridePrice)}</p>
    </button>
  );
}

const MemoTierChip = memo(TierChip);

/** Horizontal, Bolt-style compact tier selector (same data + pricing as legacy cards). */
function BookRideVehicleTierStrip({ distanceKm, vehicleTier, onSelectTier }: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-800">Vehicle</label>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] snap-x snap-mandatory">
        {VEHICLE_TIER_OPTIONS.map((ride) => (
          <MemoTierChip
            key={ride.id}
            ride={ride}
            distanceKm={distanceKm}
            selected={vehicleTier === ride.id}
            onSelect={onSelectTier}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {VEHICLE_TIER_OPTIONS.find((t) => t.id === vehicleTier)?.description ?? ""}
      </p>
    </div>
  );
}

export default memo(BookRideVehicleTierStrip);
