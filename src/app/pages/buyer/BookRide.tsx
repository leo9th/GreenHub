import { Suspense, lazy, memo, useMemo } from "react";
import { useLocation } from "react-router";
import {
  ArrowUpDown,
  CalendarDays,
  CheckCircle,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  ShieldCheck,
  X,
} from "@/app/icons/emojiLucide";
import { defaultTierFromLegacyRideType, formatNgn } from "../../../modules/rider";
import BookRideVehicleTierStrip from "./rideBooking/BookRideVehicleTierStrip";
import { useBookRideFlow } from "./rideBooking/useBookRideFlow";

const DeliveryTrackingMapPreview = lazy(() => import("../../components/maps/DeliveryTrackingMap"));
const DeliveryTrackingMapEditor = lazy(() => import("../../components/maps/DeliveryTrackingMapEditor"));

function BookRide() {
  const location = useLocation();
  const rideType =
    location.state && typeof location.state === "object" ? (location.state as { rideType?: string }).rideType ?? null : null;

  const initialTier = useMemo(() => defaultTierFromLegacyRideType(rideType), [rideType]);

  const flow = useBookRideFlow(initialTier);

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-slate-900">
      {/* Primary map canvas (persistent background) */}
      <div className="relative min-h-[min(52dvh,420px)] w-full flex-1 basis-[45%] lg:min-h-[min(56dvh,520px)]">
        <Suspense
          fallback={<div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 to-slate-900" />}
        >
          <DeliveryTrackingMapPreview
            pickupLocation={flow.pickupLocation}
            dropoffLocation={flow.dropoffLocation}
            className="absolute inset-0 h-full w-full"
            enableDemoRiderMovement={false}
          />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 via-black/20 to-transparent pb-20 pt-[max(0.75rem,env(safe-area-inset-top))] px-4">
          <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">Book a ride</h1>
          <p className="mt-0.5 text-xs font-medium text-white/90">Fares in Nigerian Naira (₦)</p>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(100%,280px)] rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          {flow.distanceKm == null ? "Set pickup & destination" : `${flow.distanceKm.toFixed(2)} km`}
        </div>
      </div>

      {/* Bottom sheet: route, vehicle, details (single hierarchy) */}
      <div
        data-ride-booking-phase={flow.uiPhase}
        className="relative z-20 flex w-full max-h-[min(58dvh,640px)] shrink-0 flex-col rounded-t-[1.25rem] border-t border-emerald-100/40 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-2.5 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Trip</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">
            {flow.selectedRide.label}
            <span className="font-normal text-gray-400"> · </span>
            {flow.estimatedFareNgn == null ? "—" : formatNgn(flow.estimatedFareNgn)}
            {flow.distanceKm != null ? (
              <span className="font-normal text-gray-500">
                {" "}
                · {flow.distanceKm.toFixed(2)} km
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Cash · Pay your rider after the trip</p>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={flow.handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3 pt-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Route</label>
              <div className="relative mt-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-950/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">Pickup</p>
                <div className="mt-1 flex gap-2">
                  <input
                    value={flow.pickupAddress}
                    onFocus={() => flow.setActiveField("pickup")}
                    onChange={(e) => flow.handlePickupInputChange(e.target.value)}
                    placeholder="Enter pickup address"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => void flow.runPickupSearch(flow.pickupAddress)}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {flow.isSearchingPickup ? "..." : "Find"}
                  </button>
                </div>
                {flow.pickupAddress.trim().length >= flow.suggestMinLen && (flow.pickupLat == null || flow.pickupLng == null) ? (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">Please select a location from the list</p>
                ) : null}
                {flow.pickupLat != null && flow.pickupLng != null ? (
                  flow.pickupSource === "gps" ? (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Using current location</p>
                  ) : (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Location confirmed
                    </p>
                  )
                ) : null}

                <button
                  type="button"
                  onClick={flow.swapRouteEndpoints}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  aria-label="Swap pickup and dropoff"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>

                <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Drop-off</p>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={flow.dropoffAddress}
                      onFocus={() => flow.setActiveField("dropoff")}
                      onChange={(e) => flow.handleDropoffInputChange(e.target.value)}
                      placeholder="Enter dropoff address"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-900 caret-gray-900 outline-none transition-all duration-150 ease-out placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => void flow.runDropoffSearch(flow.dropoffAddress)}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {flow.isSearchingDropoff ? "..." : "Find"}
                    </button>
                  </div>
                  {flow.dropoffAddress.trim().length >= flow.suggestMinLen && (flow.dropoffLat == null || flow.dropoffLng == null) ? (
                    <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">Please select a location from the list</p>
                  ) : null}
                  {flow.dropoffLat != null && flow.dropoffLng != null ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Location confirmed
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={flow.useCurrentLocation}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <Navigation className="h-3.5 w-3.5" /> Use current location
                </button>
                <button
                  type="button"
                  onClick={() => flow.openExpandedMap(flow.activeField)}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open map
                </button>
              </div>

              {flow.pickupSuggestions.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  {flow.pickupSuggestions.map((s, idx) => (
                    <button
                      key={s.id ?? `${s.lat}-${s.lng}-${idx}`}
                      type="button"
                      onClick={() => flow.selectPickupSuggestion(s)}
                      className="block w-full cursor-pointer border-b border-gray-100 px-3 py-3 text-left text-sm text-gray-800 last:border-0 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      {s.display_name}
                    </button>
                  ))}
                </div>
              ) : null}
              {flow.dropoffSuggestions.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  {flow.dropoffSuggestions.map((s, idx) => (
                    <button
                      key={s.id ?? `${s.lat}-${s.lng}-${idx}`}
                      type="button"
                      onClick={() => flow.selectDropoffSuggestion(s)}
                      className="block w-full cursor-pointer border-b border-gray-100 px-3 py-3 text-left text-sm text-gray-800 last:border-0 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      {s.display_name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <BookRideVehicleTierStrip
              distanceKm={flow.distanceKm}
              vehicleTier={flow.vehicleTier}
              onSelectTier={flow.setVehicleTier}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-100">Contact phone</label>
              <input
                value={flow.contactPhone}
                onChange={(e) => flow.setContactPhone(e.target.value)}
                placeholder="+234…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-100">Notes (optional)</label>
              <textarea
                value={flow.rideNote}
                onChange={(e) => flow.setRideNote(e.target.value)}
                rows={2}
                placeholder="Landmark, gate code…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-foreground"
              />
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs text-emerald-800 md:grid-cols-4">
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Safe Rides
                </p>
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <MapPin className="h-4 w-4" /> Live Tracking
                </p>
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <Clock3 className="h-4 w-4" /> 24/7 Support
                </p>
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <Navigation className="h-4 w-4" /> Eco Friendly
                </p>
              </div>
            </div>

            {flow.recentLocations.length > 0 ? (
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent locations</p>
                <div className="space-y-1.5">
                  {flow.recentLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => flow.applyRecentLocationTap(loc)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="line-clamp-1">{loc}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-gray-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <button
              type="submit"
              disabled={!flow.canContinue}
              ref={flow.continueBtnRef}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-base font-extrabold text-white hover:from-emerald-700 hover:to-emerald-600 disabled:pointer-events-none disabled:opacity-50"
            >
              {`Book ${flow.selectedRide.label}`}
            </button>
            <button
              type="button"
              className="inline-flex h-full min-h-[48px] w-[52px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              aria-label="Schedule ride"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>

      {flow.isMapExpanded ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/45 p-3 sm:p-5">
          <div
            ref={flow.mapModalContainerRef}
            className="mx-auto flex h-[85dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur sm:px-4">
              <button
                type="button"
                onClick={() => flow.setIsMapExpanded(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
                aria-label="Close map"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    flow.setMapInteractionMode("fixedPin");
                    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                  }}
                  className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${
                    flow.mapInteractionMode === "fixedPin" ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Fixed Pin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    flow.setMapInteractionMode("markers");
                    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                  }}
                  className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${
                    flow.mapInteractionMode === "markers" ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Markers
                </button>
              </div>
              <button
                type="button"
                onClick={() => flow.setActiveField((prev) => (prev === "pickup" ? "dropoff" : "pickup"))}
                className="min-h-11 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
              >
                Switch
              </button>
            </div>
            <div className="relative min-h-[400px] w-full flex-1 overflow-hidden p-0">
              <div className="relative h-full w-full">
                <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />}>
                  <DeliveryTrackingMapEditor
                    key={`map-editor-${flow.mapSessionId}`}
                    pickupLat={flow.expandedPickupLat}
                    pickupLng={flow.expandedPickupLng}
                    dropoffLat={flow.expandedDropoffLat}
                    dropoffLng={flow.expandedDropoffLng}
                    className="h-full w-full rounded-xl shadow-sm"
                    interactive
                    interactionMode={flow.mapInteractionMode}
                    activeField={flow.activeField}
                    showRoute
                    followPosition={false}
                    onMapCenterChange={(lat: number, lng: number) => {
                      if (flow.activeField === "pickup") {
                        flow.setDraftPickup({ lat, lng });
                      } else {
                        flow.setDraftDropoff({ lat, lng });
                      }
                    }}
                    onPickupChange={(lat: number, lng: number) => flow.setDraftPickup({ lat, lng })}
                    onDropoffChange={(lat: number, lng: number) => flow.setDraftDropoff({ lat, lng })}
                  />
                </Suspense>
                <button
                  type="button"
                  disabled={flow.isResolvingAddress}
                  onClick={async () => {
                    await flow.applyDraftToActiveField();
                    flow.setIsMapExpanded(false);
                  }}
                  className="absolute bottom-3 right-3 z-[700] inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {flow.isResolvingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {flow.isResolvingAddress ? "Finding address..." : "Done"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {flow.showConfirmSheet && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={() => flow.setShowConfirmSheet(false)}>
          <div
            ref={flow.sheetRef}
            tabIndex={-1}
            className="w-full rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
            <h3 className="mb-2 text-base font-semibold">Confirm your ride</h3>
            <p className="mb-2 text-sm text-gray-600">
              {flow.selectedRide.label} · {flow.estimatedFareNgn == null ? "—" : formatNgn(flow.estimatedFareNgn)}
            </p>
            <p className="mb-3 text-xs text-gray-500 line-clamp-2">{flow.pickupAddress}</p>
            <p className="mb-4 text-xs text-gray-500 line-clamp-2">{flow.dropoffAddress}</p>
            <button
              ref={flow.confirmBtnRef}
              type="button"
              disabled={flow.bookingSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-white disabled:opacity-60"
              onClick={() => void flow.confirmRideBooking()}
            >
              {flow.bookingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {flow.bookingSubmitting ? "Saving…" : "Confirm & request rider"}
            </button>
            <button
              type="button"
              className="mt-2 w-full text-gray-500"
              onClick={() => flow.setShowConfirmSheet(false)}
              disabled={flow.bookingSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(BookRide);
