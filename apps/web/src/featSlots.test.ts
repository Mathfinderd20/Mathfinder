import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { plannedFeatSlotsForLevel } from "./featSlots";

function infantryman(levels: number): CharacterBuild {
  return {
    name: "Bonus Feat Tester",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: {
      str: 10,
      dex: 16,
      con: 12,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: Array.from({ length: levels }, () => ({
      className: "Infantryman",
      hitPointRoll: 10,
    })),
  };
}

describe("plannedFeatSlotsForLevel", () => {
  it("grants selectable Infantryman bonus feats every four class levels", () => {
    const build = infantryman(8);

    expect(plannedFeatSlotsForLevel(build, 3)).toEqual([
      {
        kind: "general",
        label: "Infantryman bonus feat",
        source: "Infantryman 4",
      },
    ]);
    expect(plannedFeatSlotsForLevel(build, 7)).toEqual([
      {
        kind: "general",
        label: "Infantryman bonus feat",
        source: "Infantryman 8",
      },
    ]);
  });
});
