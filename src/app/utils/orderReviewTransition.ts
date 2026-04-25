export type ReviewTransition = {
  nextStatus: "paid" | "cancelled";
  eventLabel: "Review Approved" | "Review Rejected";
  metadata: Record<string, unknown>;
};

export function buildApprovalTransition(adminUserId: string | null): ReviewTransition {
  return {
    nextStatus: "paid",
    eventLabel: "Review Approved",
    metadata: {
      decision: "approved",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
    },
  };
}

export function buildRejectionTransition(reason: string, adminUserId: string | null): ReviewTransition {
  return {
    nextStatus: "cancelled",
    eventLabel: "Review Rejected",
    metadata: {
      decision: "rejected",
      reason: reason.trim(),
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
    },
  };
}
