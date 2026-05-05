import { describe, expect, it } from "vitest";
import { messageForGeolocationFailure } from "./geolocationErrorMessage";

function mockGeoError(code: number, message: string): GeolocationPositionError {
  return { code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

describe("messageForGeolocationFailure", () => {
  it("returns permission-denied copy for code 1", () => {
    expect(messageForGeolocationFailure(mockGeoError(1, "User denied"))).toBe(
      "Location permission is blocked. Please allow location access to go online as a rider.",
    );
  });

  it("returns timeout copy for code 3", () => {
    expect(messageForGeolocationFailure(mockGeoError(3, "Timeout"))).toBe(
      "We could not get your location in time. Please try again in an open area.",
    );
  });

  it("falls back to message or generic for other codes", () => {
    expect(messageForGeolocationFailure(mockGeoError(2, "No position"))).toBe("No position");
    expect(messageForGeolocationFailure(mockGeoError(0, ""))).toBe("Could not access location.");
  });
});
