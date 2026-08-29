import { describe, expect, it } from "vitest";
import { plannerRollbackCount } from "./plannerState";

describe("plannerRollbackCount", () => {
  it("restores the level count from before Plan to Here", () => {
    expect(
      plannerRollbackCount(1, 19, {
        previousCount: 1,
        targetCount: 20,
      }),
    ).toBe(1);
  });

  it("makes an unrelated future row and later rows untouched", () => {
    expect(
      plannerRollbackCount(3, 9, {
        previousCount: 3,
        targetCount: 20,
      }),
    ).toBe(9);
  });

  it("never removes applied character levels", () => {
    expect(plannerRollbackCount(5, 3, null)).toBe(5);
  });
});
