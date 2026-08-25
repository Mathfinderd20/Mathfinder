import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { RUNTIME_ARMOR, RUNTIME_WEAPONS } from "../content";
import {
  materializeRaceChoice,
  normalizeBuild,
  syncTemplatedWeaponsToCampaignRules,
} from "./buildNormalization";

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

describe("build normalization", () => {
  it("removes the legacy zero weight override so gear and coins can count", () => {
    const source = build();
    source.carriedWeight = 0;
    expect(normalizeBuild(source).carriedWeight).toBeUndefined();
  });
});

describe("campaign equipment pricing", () => {
  it("reprices templated firearms reversibly from their canonical cost", () => {
    RUNTIME_WEAPONS.push({
      id: "test-campaign-pistol",
      name: "Campaign Pistol",
      category: "ranged",
      proficiencyGroup: "exotic",
      damageDice: "1d8",
      critMultiplier: 4,
      firearmCategory: "one-handed",
      weightLb: 4,
      costGp: 1_000,
    });
    try {
      const source = build();
      source.equipment = [
        {
          itemTemplateId: "test-campaign-pistol",
          name: "Campaign Pistol",
          costGp: 1_000,
          weapon: { category: "ranged", damageDice: "1d8" },
        },
      ];
      source.campaignRules = { firearmRules: "guns-everywhere" };
      const discounted = syncTemplatedWeaponsToCampaignRules(source);
      expect(discounted.equipment?.[0]?.costGp).toBe(100);
      expect(
        syncTemplatedWeaponsToCampaignRules(discounted).equipment?.[0]?.costGp,
      ).toBe(100);
      expect(
        syncTemplatedWeaponsToCampaignRules({
          ...discounted,
          campaignRules: undefined,
        }).equipment?.[0]?.costGp,
      ).toBe(1_000);
    } finally {
      RUNTIME_WEAPONS.pop();
    }
  });

  it("leaves custom ammunition pricing untouched", () => {
    const source = build();
    source.campaignRules = { firearmRules: "guns-everywhere" };
    source.equipment = [
      {
        name: "Experimental Slugs",
        ammoType: "experimental slug",
        quantity: 3,
        costGp: 42,
        weight: 2,
      },
    ];
    expect(
      syncTemplatedWeaponsToCampaignRules(source).equipment?.[0],
    ).toMatchObject({ costGp: 42, weight: 2 });
  });

  it("reprices catalog ammunition reversibly without compounding discounts", () => {
    const source = build();
    source.equipment = [
      {
        name: "Bullets",
        ammoType: "bullet",
        quantity: 10,
        costGp: 100,
        weight: 1,
      },
    ];
    source.campaignRules = { firearmRules: "guns-everywhere" };
    const discounted = syncTemplatedWeaponsToCampaignRules(source);
    expect(discounted.equipment?.[0]).toMatchObject({
      quantity: 10,
      costGp: 1,
      weight: 0.1,
    });
    const discountedAgain = syncTemplatedWeaponsToCampaignRules(discounted);
    expect(discountedAgain.equipment?.[0]?.costGp).toBe(1);
    const restored = syncTemplatedWeaponsToCampaignRules({
      ...discountedAgain,
      campaignRules: undefined,
    });
    expect(restored.equipment?.[0]?.costGp).toBe(10);
  });
});

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
