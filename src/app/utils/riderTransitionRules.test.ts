import { describe, expect, it } from "vitest";
import {
  canRiderMutateAssigned,
  canTransitionDelivery,
  canTransitionProductRide,
} from "./riderTransitionRules";

describe("rider transition rules", () => {
  it("allows valid delivery transition", () => {
    expect(canTransitionDelivery("assigned", "picked_up")).toBe(true);
  });

  it("rejects invalid delivery transition", () => {
    expect(canTransitionDelivery("pending", "delivered")).toBe(false);
  });

  it("allows valid product ride transition", () => {
    expect(canTransitionProductRide("accepted", "en_route")).toBe(true);
  });

  it("rejects invalid product ride transition", () => {
    expect(canTransitionProductRide("en_route", "accepted")).toBe(false);
  });

  it("enforces assigned rider authorization", () => {
    expect(canRiderMutateAssigned("rider-a", "rider-a")).toBe(true);
    expect(canRiderMutateAssigned("rider-a", "rider-b")).toBe(false);
  });

  it("treats same-state transition as idempotent", () => {
    expect(canTransitionDelivery("picked_up", "picked_up")).toBe(true);
    expect(canTransitionProductRide("accepted", "accepted")).toBe(true);
  });
});
