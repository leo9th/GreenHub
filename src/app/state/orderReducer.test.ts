import { describe, expect, it } from "vitest";
import { initialOrderState, orderReducer } from "./OrderReducer";

describe("orderReducer", () => {
  it("UPDATE_RIDER_LOCATION keeps previous bearing when bearing is null", () => {
    const withLoc = orderReducer(initialOrderState, {
      type: "UPDATE_RIDER_LOCATION",
      lat: 9.0,
      lng: 8.5,
      bearing: 45,
      lastSeenAt: "2026-05-02T12:00:00.000Z",
    });
    expect(withLoc.currentRiderLocation?.bearing).toBe(45);

    const noBearing = orderReducer(withLoc, {
      type: "UPDATE_RIDER_LOCATION",
      lat: 9.01,
      lng: 8.51,
      bearing: null,
      lastSeenAt: "2026-05-02T12:00:15.000Z",
    });
    expect(noBearing.currentRiderLocation?.lat).toBe(9.01);
    expect(noBearing.currentRiderLocation?.bearing).toBe(45);
  });

  it("UPDATE_RIDER_LOCATION uses 0 for bearing when no previous location", () => {
    const s = orderReducer(initialOrderState, {
      type: "UPDATE_RIDER_LOCATION",
      lat: 9.0,
      lng: 8.5,
      bearing: null,
    });
    expect(s.currentRiderLocation?.bearing).toBe(0);
  });

  it("CLEAR_RIDER_LOCATION clears currentRiderLocation", () => {
    const withLoc = orderReducer(initialOrderState, {
      type: "UPDATE_RIDER_LOCATION",
      lat: 9.0,
      lng: 8.5,
      bearing: 0,
    });
    const cleared = orderReducer(withLoc, { type: "CLEAR_RIDER_LOCATION" });
    expect(cleared.currentRiderLocation).toBeNull();
  });
});
