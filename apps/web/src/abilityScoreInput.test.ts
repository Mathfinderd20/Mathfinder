import { describe, expect, it } from "vitest";
import { parseAbilityScoreInput } from "./abilityScoreInput";

describe("ability score input", () => {
  it("preserves valid whole-number scores", () => {
    expect(parseAbilityScoreInput("7")).toBe(7);
    expect(parseAbilityScoreInput("12")).toBe(12);
    expect(parseAbilityScoreInput("18")).toBe(18);
  });

  it("leaves incomplete and invalid input unresolved", () => {
    for (const value of ["", "6", "19", "10.5", "nope"])
      expect(parseAbilityScoreInput(value)).toBeUndefined();
  });
});
