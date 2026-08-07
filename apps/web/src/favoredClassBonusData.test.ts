import { describe, expect, it } from "vitest";
import { buildFavoredClassBonusOptions } from "./favoredClassBonusData";

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
});
