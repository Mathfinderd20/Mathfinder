import { describe, expect, it } from "vitest";
import { skillMetadataTooltip, skillTrainingFlag } from "./skillPresentation";

describe("skill presentation", () => {
  it("uses consistent training abbreviations", () => {
    expect(skillTrainingFlag(false, true)).toBe("U");
    expect(skillTrainingFlag(true, true)).toBe("T");
    expect(skillTrainingFlag(true, false)).toBe("TU");
  });

  it("explains class, training, ability, and armor metadata", () => {
    const content = skillMetadataTooltip({
      ability: "dex",
      isClassSkill: true,
      trainedOnly: true,
      usable: false,
      armorCheckPenalty: true,
      className: "Rogue",
    });

    expect(content).toContain("DEX — Key ability");
    expect(content).toContain("C — Class skill for Rogue");
    expect(content).toContain("TU — Trained-only");
    expect(content).toContain("A — Armor check penalty applies");
  });
});
