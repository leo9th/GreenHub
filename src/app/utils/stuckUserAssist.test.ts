import { describe, expect, it } from "vitest";
import { getStuckUserAssist } from "./stuckUserAssist";

describe("getStuckUserAssist", () => {
  it("returns helpful c2c review guidance", () => {
    const assist = getStuckUserAssist("c2c_high_value_review");

    expect(assist.blockedReason).toBe("c2c_high_value_review");
    expect(assist.userMessage).toContain("quick trust review");
    expect(assist.nextBestAction).toContain("Submit order for review");
  });
});
