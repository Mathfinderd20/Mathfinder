import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { materializeRaceChoice } from "./buildNormalization";

function build(): CharacterBuild {
  return {
    name: "Normalizer",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: {
      str: 18,
      dex: 14,
      con: 12,
      int: 10,
      wis: 8,
      cha: 10,
    },
    levels: [{ className: "Fighter", hitPointRoll: 10 }],
  };
}

describe("race choice materialization", () => {
  it("removes stale trait and feat selections while preserving legal choices", () => {
    const race: CharacterBuild["race"] = {
      name: "Human",
      size: "medium",
      choiceOptions: {
        flexibleAbilityBonus: { value: 2, abilities: ["str", "dex"] },
        bonusFeat: { featOptions: ["Power Attack"] },
      },
      alternateTraits: [
        {
          id: "legal",
          name: "Legal",
          description: "A legal alternate trait.",
          replaces: [],
        },
      ],
    };
    const resolved = materializeRaceChoice(race, build(), {
      ...race,
      choiceSelection: {
        alternateTraits: ["legal", "LEGAL", "missing"],
        flexibleAbility: "dex",
        bonusFeat: "Unknown Feat",
      },
    });

    expect(resolved.choiceSelection).toEqual({
      alternateTraits: ["legal"],
      flexibleAbility: "dex",
      bonusFeat: undefined,
    });
  });

  it("defaults a flexible bonus to the character's strongest legal ability", () => {
    const race: CharacterBuild["race"] = {
      name: "Flexible",
      size: "medium",
      choiceOptions: {
        flexibleAbilityBonus: { value: 2, abilities: ["str", "dex"] },
      },
    };
    expect(
      materializeRaceChoice(race, build()).choiceSelection?.flexibleAbility,
    ).toBe("str");
  });
});
