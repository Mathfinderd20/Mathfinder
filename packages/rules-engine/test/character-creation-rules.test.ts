import { describe, expect, it } from "vitest";
import {
  creationWarnings,
  DEFAULT_CREATION_RULES,
  pointBuyCost,
  pointBuyTotal,
  parseCharacterCreationRules,
  validateCreationRules,
} from "../src/character-creation-rules";

describe("PF1e character generation", () => {
  it("uses the complete PF1e cost table", () => {
    expect(Array.from({ length: 12 }, (_, i) => pointBuyCost(i + 7))).toEqual([
      -4, -2, -1, 0, 1, 2, 3, 5, 7, 10, 13, 17,
    ]);
  });
  it("totals base scores including refunds", () => {
    expect(pointBuyTotal([10, 10, 10, 10, 10, 10])).toBe(0);
    expect(pointBuyTotal([16, 14, 14, 12, 10, 8])).toBe(20);
    expect(pointBuyTotal([7, 7, 7, 7, 7, 7])).toBe(-24);
  });
  it("rejects invalid or incomplete scores", () => {
    for (const score of [6, 19, 10.5, NaN, Infinity])
      expect(() => pointBuyCost(score)).toThrow();
    expect(() => pointBuyTotal([10])).toThrow();
  });
  it("warns without mutating builds", () => {
    const scores = [18, 18, 18, 18, 18, 18];
    expect(
      creationWarnings(scores, 1, {
        ...DEFAULT_CREATION_RULES,
        method: "point-buy",
      }),
    ).toHaveLength(1);
    expect(scores).toEqual([18, 18, 18, 18, 18, 18]);
  });
  it("allows array permutations but not duplicate substitutions", () => {
    const rules = { ...DEFAULT_CREATION_RULES, method: "array" as const };
    expect(creationWarnings([8, 10, 12, 13, 14, 15], 1, rules)).toEqual([]);
    expect(creationWarnings([15, 15, 13, 12, 10, 8], 1, rules)).toHaveLength(1);
  });
  it("validates settings and higher-level guidance", () => {
    expect(validateCreationRules(DEFAULT_CREATION_RULES)).toEqual([]);
    expect(
      validateCreationRules({ ...DEFAULT_CREATION_RULES, startingLevel: 0 }),
    ).toHaveLength(1);
    expect(
      creationWarnings([10, 10, 10, 10, 10, 10], 1, {
        ...DEFAULT_CREATION_RULES,
        startingLevel: 5,
      }),
    ).toHaveLength(1);
    expect(
      creationWarnings([10, 10, 10, 10, 10, 10], 6, {
        ...DEFAULT_CREATION_RULES,
        startingLevel: 5,
      }),
    ).toHaveLength(1);
  });

  it("parses only complete creation rules from storage or API data", () => {
    expect(parseCharacterCreationRules(DEFAULT_CREATION_RULES)).toEqual(
      DEFAULT_CREATION_RULES,
    );
    expect(
      parseCharacterCreationRules({ method: "point-buy" }),
    ).toBeUndefined();
    expect(
      parseCharacterCreationRules({
        ...DEFAULT_CREATION_RULES,
        abilityArray: [6, 14, 13, 12, 10, 8],
      }),
    ).toBeUndefined();
  });
});
