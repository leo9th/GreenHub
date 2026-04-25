import { describe, expect, it, vi } from "vitest";
import { buildApprovalTransition, buildRejectionTransition } from "./orderReviewTransition";

describe("order review transitions", () => {
  it("builds approval transition to paid state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    const transition = buildApprovalTransition("admin-1");

    expect(transition.nextStatus).toBe("paid");
    expect(transition.eventLabel).toBe("Review Approved");
    expect(transition.metadata).toMatchObject({
      decision: "approved",
      reviewed_by: "admin-1",
      reviewed_at: "2026-01-01T10:00:00.000Z",
    });

    vi.useRealTimers();
  });

  it("builds rejection transition to cancelled state with reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:30:00.000Z"));

    const transition = buildRejectionTransition(" Risk mismatch ", "admin-2");

    expect(transition.nextStatus).toBe("cancelled");
    expect(transition.eventLabel).toBe("Review Rejected");
    expect(transition.metadata).toMatchObject({
      decision: "rejected",
      reason: "Risk mismatch",
      reviewed_by: "admin-2",
      reviewed_at: "2026-01-01T12:30:00.000Z",
    });

    vi.useRealTimers();
  });
});
