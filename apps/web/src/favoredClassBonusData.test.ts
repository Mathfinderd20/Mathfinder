import { describe, expect, it } from "vitest";
import {
  buildFavoredClassBonusOptions,
  favoredClassBonusCoverage,
} from "./favoredClassBonusData";

const race = {
  name: "Half-Orc",
  size: "medium" as const,
  favoredClassBonuses: [
    {
      id: "orc-fighter-death-threshold",
      className: "Fighter",
      label: "Orc resilience",
      description: "Death threshold",
      deathThresholdBonus: 2,
    },
  ],
};

describe("favored-class bonus options", () => {
  it("adds ancestry options only for their matching class", () => {
    expect(
      buildFavoredClassBonusOptions(race, "Fighter").map(
        (option) => option.value,
      ),
    ).toContain("orc-fighter-death-threshold");
    expect(
      buildFavoredClassBonusOptions(race, "Rogue").map(
        (option) => option.value,
      ),
    ).not.toContain("orc-fighter-death-threshold");
  });

  it("reports ancestry-specific coverage honestly", () => {
    expect(favoredClassBonusCoverage(race, "Fighter")).toMatchObject({
      hasAncestrySpecificOptions: true,
    });
    expect(favoredClassBonusCoverage(race, "Rogue")).toEqual({
      hasAncestrySpecificOptions: false,
      message:
        "Universal +1 HP and +1 skill rank are available. No ancestry-specific Half-Orc Rogue bonus is loaded yet.",
    });
  });
});
