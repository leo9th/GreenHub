/** Maps browser GeolocationPositionError to rider-facing copy. */
export function messageForGeolocationFailure(geoError: GeolocationPositionError): string {
  if (geoError.code === 1) {
    return "Location permission is blocked. Please allow location access to go online as a rider.";
  }
  if (geoError.code === 3) {
    return "We could not get your location in time. Please try again in an open area.";
  }
  return geoError.message?.trim() || "Could not access location.";
}
