import { describe, expect, it } from "vitest";
import {
  hitPointExpression,
  partitionRaceNotes,
  healthPresentation,
} from "./characterPresentation";

describe("character presentation", () => {
  it.each([
    [100, "Healthy", "green"],
    [99, "Minor Injury", "yellow"],
    [85, "Minor Injury", "yellow"],
    [84, "Bloodied", "orange"],
    [50, "Bloodied", "orange"],
    [49, "Wounded", "red"],
    [24, "Wounded", "red"],
  ])("maps %s percent to %s", (hp, label, tone) => {
    expect(healthPresentation(hp as number, 100, "wounded")).toEqual({
      percent: hp,
      label,
      tone,
    });
  });
  it("rounds down and lets mechanical states override injury bands", () => {
    expect(healthPresentation(2, 3, "wounded").percent).toBe(66);
    expect(healthPresentation(80, 100, "unconscious")).toMatchObject({
      label: "Unconscious",
      tone: "red",
    });
    expect(healthPresentation(0, 10, "disabled").label).toBe("Disabled");
    expect(healthPresentation(-1, 10, "dying").label).toBe("Dying");
    expect(healthPresentation(-10, 10, "dead").label).toBe("Dead");
  });
  it("keeps temporary HP separate from the actual HP fraction", () => {
    expect(hitPointExpression(9, 10, 5)).toBe("9/10 + 5 HP");
    expect(hitPointExpression(10, 12, 5)).toBe("10/12 + 5 HP");
    expect(hitPointExpression(-2, 10, 5)).toBe("-2/10 + 5 HP");
    expect(hitPointExpression(9, 10, 0)).toBe("9/10 HP");
  });

  it("separates build bookkeeping from playable traits and defenses", () => {
    expect(
      partitionRaceNotes([
        "Flexible racial bonus: STR +2",
        "Extra skill rank per level: +1",
        "Bonus feat: Dodge",
        "Immune to magical sleep",
        "Elven magic",
        "Languages: Common, Elven",
        "Darkvision 60 ft",
      ]),
    ).toEqual({
      build: [
        "Flexible racial bonus: STR +2",
        "Extra skill rank per level: +1",
        "Bonus feat: Dodge",
      ],
      traits: ["Elven magic"],
      defenses: ["Immune to magical sleep"],
      languagesAndSenses: ["Languages: Common, Elven", "Darkvision 60 ft"],
    });
  });
  it("handles actors without racial metadata", () => {
    expect(partitionRaceNotes()).toEqual({
      build: [],
      traits: [],
      defenses: [],
      languagesAndSenses: [],
    });
  });
});
