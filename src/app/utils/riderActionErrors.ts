export function riderActionErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("authentication required")) return "Please sign in to continue.";
  if (message.includes("approved rider required") || message.includes("rider is not approved")) {
    return "Only approved rider accounts can perform this action.";
  }
  if (message.includes("only assigned rider")) return "This job is assigned to another rider.";
  if (message.includes("invalid transition")) return "This action is not allowed from the current job status.";
  if (message.includes("not found")) return "This job could not be found or is no longer available.";
  if (message.includes("not eligible")) return "This action is not available for the current job state.";
  if (message.includes("not assignable")) return "This job cannot be accepted right now.";
  if (message.includes("already assigned")) return "This job has already been assigned.";
  if (message.includes("pin incorrect")) return "Delivery PIN is incorrect.";

  return raw.trim() || fallback;
}
