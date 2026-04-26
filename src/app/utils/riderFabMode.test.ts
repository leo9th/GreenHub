import { describe, expect, it } from "vitest";
import {
  normalizeRiderFabMode,
  resolveInitialRiderFabMode,
  riderFabModeStorageKey,
} from "./riderFabMode";

describe("riderFabMode helpers", () => {
  it("builds namespaced storage key", () => {
    expect(riderFabModeStorageKey("user-123")).toBe("gh_rider_presence_mode:user-123");
  });

  it("normalizes valid modes", () => {
    expect(normalizeRiderFabMode("booking")).toBe("booking");
    expect(normalizeRiderFabMode("rider")).toBe("rider");
  });

  it("rejects unknown mode values", () => {
    expect(normalizeRiderFabMode("foo")).toBeNull();
    expect(normalizeRiderFabMode(null)).toBeNull();
  });

  it("defaults non rider-capable users to booking", () => {
    expect(resolveInitialRiderFabMode({ isRiderCapable: false, savedMode: "rider" })).toBe("booking");
  });

  it("uses saved mode for rider-capable users", () => {
    expect(resolveInitialRiderFabMode({ isRiderCapable: true, savedMode: "booking" })).toBe("booking");
  });

  it("defaults rider-capable users to rider when unset", () => {
    expect(resolveInitialRiderFabMode({ isRiderCapable: true, savedMode: null })).toBe("rider");
  });
});
