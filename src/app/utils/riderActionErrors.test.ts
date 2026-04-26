import { describe, expect, it } from "vitest";
import { riderActionErrorMessage } from "./riderActionErrors";

describe("riderActionErrorMessage", () => {
  it("maps not found errors", () => {
    expect(riderActionErrorMessage(new Error("Ride booking not found"), "fallback")).toBe(
      "This job could not be found or is no longer available.",
    );
  });

  it("maps invalid transition errors", () => {
    expect(riderActionErrorMessage(new Error("Invalid transition: only assigned"), "fallback")).toBe(
      "This action is not allowed from the current job status.",
    );
  });

  it("returns fallback when empty", () => {
    expect(riderActionErrorMessage("", "fallback")).toBe("fallback");
  });
});
