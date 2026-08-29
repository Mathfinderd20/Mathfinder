import { describe, expect, it } from "vitest";
import { isCriticalHealth } from "./HealthTracker";

describe("health tracker presentation", () => {
  it("marks positive hit points below twenty percent as critical", () => {
    expect(isCriticalHealth(3, 20)).toBe(true);
    expect(isCriticalHealth(4, 20)).toBe(false);
    expect(isCriticalHealth(0, 20)).toBe(false);
    expect(isCriticalHealth(5, 0)).toBe(false);
  });
});
