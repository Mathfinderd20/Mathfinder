import { describe, expect, it } from "vitest";
import { deriveHealthStatus, stabilizationCheck } from "../src/vitals";

describe("PF1e health conditions", () => {
  const status = (
    currentHp: number,
    options: { nonlethalDamage?: number; stable?: boolean } = {},
  ) =>
    deriveHealthStatus({
      maxHp: 20,
      currentHp,
      constitutionScore: 12,
      ...options,
    });

  it("tracks disabled, dying, stable, and death at negative Constitution", () => {
    expect(status(0).condition).toBe("disabled");
    expect(status(-1).condition).toBe("dying");
    expect(status(-1, { stable: true }).condition).toBe("stable");
    expect(status(-12).condition).toBe("dead");
    expect(status(-11).condition).toBe("dying");
  });

  it("tracks nonlethal staggered and unconscious states", () => {
    expect(status(8, { nonlethalDamage: 8 }).condition).toBe("staggered");
    expect(status(8, { nonlethalDamage: 9 }).condition).toBe("unconscious");
  });
});

describe("PF1e stabilization checks", () => {
  it("applies Constitution modifier and current negative HP as a penalty", () => {
    expect(stabilizationCheck(-3, 14, 11)).toEqual({
      roll: 11,
      modifier: -1,
      total: 10,
      dc: 10,
      success: true,
      hpLoss: 0,
    });
    expect(stabilizationCheck(-3, 14, 10).hpLoss).toBe(1);
  });

  it("allows a natural 20 to stabilize automatically", () => {
    expect(stabilizationCheck(-15, 8, 20).success).toBe(true);
  });
});
