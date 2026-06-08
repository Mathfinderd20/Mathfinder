import { describe, expect, it } from "vitest";
import { deriveEncumbrance, loadThresholds } from "../src/encumbrance";

describe("encumbrance", () => {
  it("uses the PF1e carrying capacity table", () => {
    expect(loadThresholds(10)).toEqual({ lightMax: 33, mediumMax: 66, heavyMax: 100 });
    expect(loadThresholds(18)).toEqual({ lightMax: 100, mediumMax: 200, heavyMax: 300 });
  });

  it("classifies load bands correctly", () => {
    expect(deriveEncumbrance(16, 70).band).toBe("light");
    expect(deriveEncumbrance(16, 150).band).toBe("medium");
    expect(deriveEncumbrance(16, 230).band).toBe("heavy");
    expect(deriveEncumbrance(16, 231).band).toBe("overloaded");
  });
});
