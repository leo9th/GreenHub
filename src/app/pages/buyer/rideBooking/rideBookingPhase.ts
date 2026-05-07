/**
 * High-level UI phases for the standalone `/book` ride flow.
 * Phase 1: derived from existing flags only (no parallel state) so behavior cannot desync.
 * Later phases: drive sheet content / snap heights from this enum explicitly.
 */
export type RideBookingUiPhase =
  | "route_and_options"
  | "map_pin_edit"
  | "confirm_request_sheet";

export function deriveRideBookingUiPhase(input: {
  showConfirmSheet: boolean;
  isMapExpanded: boolean;
}): RideBookingUiPhase {
  if (input.showConfirmSheet) return "confirm_request_sheet";
  if (input.isMapExpanded) return "map_pin_edit";
  return "route_and_options";
}
