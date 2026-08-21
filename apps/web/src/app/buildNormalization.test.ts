import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { RUNTIME_ARMOR } from "../content";
import { materializeRaceChoice, normalizeBuild } from "./buildNormalization";

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

describe("equipment normalization", () => {
  it("upgrades manually named catalog armor so saved builds gain new mechanics", () => {
    RUNTIME_ARMOR.push({
      id: "sc-savage-plate",
      name: "Savage Plate",
      categoryNormalized: "heavy",
      armorBonus: 6,
      maxDexBonus: 4,
      armorCheckPenalty: -6,
      speed30: 20,
      speed20: 15,
      rangedTouchArmorFraction: 0.5,
    });
    try {
      const source = build();
      source.equipment = [
        { name: "savage plate", equipped: true, slot: "armor" },
      ];
      expect(normalizeBuild(source).equipment?.[0]).toMatchObject({
        itemTemplateId: "sc-savage-plate",
        name: "Savage Plate",
        armor: {
          acBonus: 6,
          checkPenalty: 6,
          speed30: 20,
          speed20: 15,
          rangedTouchArmorFraction: 0.5,
        },
      });
    } finally {
      RUNTIME_ARMOR.pop();
    }
  });
});

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
