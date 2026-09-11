import { describe, expect, it } from "vitest";
import {
  buildFavoredClassBonusOptions,
  favoredClassBonusDetailIsComplete,
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

  it("adds required controls for parameterized sorcerer bonuses", () => {
    const sorcererRace = {
      ...race,
      favoredClassBonuses: [
        {
          id: "terrain",
          className: "Sorcerer",
          label: "Terrain magic",
          description:
            "Choose a terrain type from the ranger’s favored terrain list.",
        },
        {
          id: "bloodline",
          className: "Sorcerer",
          label: "Bloodline uses",
          description: "Select one bloodline power at 1st level.",
        },
      ],
    };
    const options = buildFavoredClassBonusOptions(sorcererRace, "Sorcerer");

    expect(
      options.find((option) => option.value === "terrain")?.detail,
    ).toMatchObject({ control: "select", label: "Chosen favored terrain" });
    expect(
      options.find((option) => option.value === "bloodline")?.detail,
    ).toEqual({ control: "text", label: "Chosen bloodline power" });
    expect(
      favoredClassBonusDetailIsComplete(options, "terrain", undefined),
    ).toBe(false);
    expect(
      favoredClassBonusDetailIsComplete(options, "terrain", "Forest"),
    ).toBe(true);
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
