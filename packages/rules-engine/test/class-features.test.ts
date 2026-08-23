import { describe, expect, it } from "vitest";
import {
  CLASS_FEATURES,
  CORE_CLASS_FEATURES,
  classFeaturesGrantedAt,
} from "../src/content/class-features";
import {
  activatableFeaturesForDescriptor,
  activatableResourceMax,
} from "../src/content/activatables";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { computeSheet } from "../src/compute";

describe("class feature progression", () => {
  it("grants Barbarian level-1 features from the registry", () => {
    const features = classFeaturesGrantedAt(CLASS_FEATURES, "Barbarian", 1).map(
      (f) => f.name,
    );
    expect(features).toEqual(["Fast Movement", "Rage"]);
  });

  describe("Infantryman gun training scaffolding", () => {
    it("grants Dexterity-to-damage overrides for the first selected firearm at class level 5", () => {
      const build: CharacterBuild = {
        name: "Shooty",
        race: {
          name: "Human",
          size: "medium",
          speed: 30,
          abilityModifiers: [],
        },
        baseAbilityScores: {
          str: 12,
          dex: 16,
          con: 12,
          int: 10,
          wis: 12,
          cha: 8,
        },
        levels: Array.from({ length: 5 }, () => ({
          className: "Infantryman",
          hitPointRoll: 10,
        })),
        gunTrainingSelections: { infantryman: ["Pistol", "Musket"] },
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
          {
            name: "Musket",
            weaponTemplateId: "musket",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d12",
            critMultiplier: 4,
            rangeIncrementFeet: 40,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "full-round",
            firearmCategory: "two-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
      };
      const sheet = computeSheet(buildCharacter(build));
      expect(sheet.weapons[0]?.damageDisplay).toBe("1d8+3");
      expect(sheet.weapons[1]?.damageDisplay).toBe("1d12");
    });

    it("limits Infantryman gun training to one selected firearm", () => {
      const build: CharacterBuild = {
        name: "Shootier",
        race: {
          name: "Human",
          size: "medium",
          speed: 30,
          abilityModifiers: [],
        },
        baseAbilityScores: {
          str: 12,
          dex: 16,
          con: 12,
          int: 10,
          wis: 12,
          cha: 8,
        },
        levels: Array.from({ length: 9 }, () => ({
          className: "Infantryman",
          hitPointRoll: 10,
        })),
        gunTrainingSelections: { infantryman: ["Pistol", "Musket"] },
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
          {
            name: "Musket",
            weaponTemplateId: "musket",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d12",
            critMultiplier: 4,
            rangeIncrementFeet: 40,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "full-round",
            firearmCategory: "two-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
      };
      const sheet = computeSheet(buildCharacter(build));
      expect(sheet.weapons[0]?.damageDisplay).toBe("1d8+3");
      expect(sheet.weapons[1]?.damageDisplay).toBe("1d12");
    });

    it("grants selected-firearm Dexterity damage at level 1 under Guns Everywhere", () => {
      const build: CharacterBuild = {
        name: "Everywhere Shooty",
        race: {
          name: "Human",
          size: "medium",
          speed: 30,
          abilityModifiers: [],
        },
        campaignRules: { firearmRules: "guns-everywhere" },
        baseAbilityScores: {
          str: 12,
          dex: 16,
          con: 12,
          int: 10,
          wis: 12,
          cha: 8,
        },
        levels: [{ className: "Infantryman", hitPointRoll: 10 }],
        gunTrainingSelections: { infantryman: ["Pistol"] },
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
      };
      const sheet = computeSheet(buildCharacter(build));
      expect(sheet.weapons[0]?.damageDisplay).toBe("1d8+3");
    });

    it("does not grant Infantryman gun training overrides before class level 5", () => {
      const build: CharacterBuild = {
        name: "NotYetShooty",
        race: {
          name: "Human",
          size: "medium",
          speed: 30,
          abilityModifiers: [],
        },
        baseAbilityScores: {
          str: 12,
          dex: 16,
          con: 12,
          int: 10,
          wis: 12,
          cha: 8,
        },
        levels: Array.from({ length: 4 }, () => ({
          className: "Infantryman",
          hitPointRoll: 10,
        })),
        gunTrainingSelections: { infantryman: ["Pistol"] },
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
      };
      const sheet = computeSheet(buildCharacter(build));
      expect(sheet.weapons[0]?.damageDisplay).toBe("1d8");
    });
  });
});

describe("class feature effects auto-apply through buildCharacter", () => {
  const build: CharacterBuild = {
    name: "Grukk",
    race: {
      name: "Half-Orc",
      size: "medium",
      speed: 30,
      abilityModifiers: [
        { target: "str", type: "racial", value: 2, source: "Half-Orc" },
      ],
    },
    baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    levels: [
      { className: "Barbarian", hitPointRoll: 12, feats: ["Toughness"] },
    ],
  };
  const sheet = computeSheet(buildCharacter(build));

  it("surfaces auto-granted class features on the descriptor", () => {
    expect(sheet.descriptor.features.map((f) => f.name)).toEqual([
      "Fast Movement",
      "Rage",
    ]);
  });

  it("applies passive feature effects like Fast Movement", () => {
    expect(sheet.speed.total).toBe(40); // 30 base + 10 Fast Movement
    expect(sheet.encumbrance.band).toBe("light");
  });

  it("resolves Rage as an activatable class feature from the descriptor", () => {
    expect(
      activatableFeaturesForDescriptor(CLASS_FEATURES, sheet.descriptor).map(
        (f) => f.name,
      ),
    ).toEqual(["Rage"]);
  });

  it("exposes Rage rounds/day as a resource pool (4 + Con + 2/level after 1st)", () => {
    const rage = CORE_CLASS_FEATURES.find(
      (f) => f.id === "barbarian-rage-l1",
    )!.activatable!;
    const max = activatableResourceMax(rage, {
      baseAttackBonus: 1,
      characterLevel: 1,
      abilityModifiers: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: -1 },
    });
    expect(max).toBe(6); // 4 + Con 2 + 0
  });

  it("suppresses Rage while fatigued and removes its activatable toggle", () => {
    const fatiguedBuild: CharacterBuild = {
      ...build,
      conditions: ["fatigued"],
    };
    const fatiguedSheet = computeSheet(buildCharacter(fatiguedBuild));
    expect(fatiguedSheet.descriptor.suppressedFeatures).toContainEqual({
      name: "Rage",
      level: 1,
      reason: "fatigued",
    });
    expect(
      activatableFeaturesForDescriptor(
        CLASS_FEATURES,
        fatiguedSheet.descriptor,
      ).map((f) => f.name),
    ).toEqual([]);
  });

  it("does not suppress Fast Movement for shields alone", () => {
    const shieldBuild: CharacterBuild = {
      ...build,
      equipment: [
        {
          name: "Heavy Wooden Shield",
          equipped: true,
          slot: "shield",
          shield: { acBonus: 2, checkPenalty: 2 },
        },
      ],
    };
    const shieldSheet = computeSheet(buildCharacter(shieldBuild));
    expect(shieldSheet.speed.total).toBe(40);
    expect(shieldSheet.descriptor.suppressedFeatures).toEqual([]);
  });

  it("keeps Fast Movement in medium armor and lets armor penalty subtract separately", () => {
    const mediumArmorBuild: CharacterBuild = {
      ...build,
      equipment: [
        {
          name: "Scale mail",
          equipped: true,
          armor: { category: "medium", speedPenalty: 10 },
        },
      ],
    };
    const mediumArmorSheet = computeSheet(buildCharacter(mediumArmorBuild));
    expect(mediumArmorSheet.speed.total).toBe(30); // 30 base + 10 Fast Movement - 10 armor
    expect(mediumArmorSheet.speed.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "base speed", value: 30 }),
        expect.objectContaining({ source: "Fast Movement", value: 10 }),
        expect.objectContaining({ source: "Scale mail (armor)", value: -10 }),
      ]),
    );
    expect(mediumArmorSheet.descriptor.suppressedFeatures).toEqual([]);
  });

  it("suppresses Fast Movement under heavy load", () => {
    const heavyLoadBuild: CharacterBuild = {
      ...build,
      carriedWeight: 230,
    };
    const heavyLoadSheet = computeSheet(buildCharacter(heavyLoadBuild));
    expect(heavyLoadSheet.encumbrance.band).toBe("heavy");
    expect(heavyLoadSheet.speed.total).toBe(30); // Fast Movement suppressed
    expect(heavyLoadSheet.descriptor.suppressedFeatures).toEqual([
      { name: "Fast Movement", level: 1, reason: "heavy load" },
    ]);
  });

  it("dedupes features if a build manually repeats an auto-granted one", () => {
    const dupBuild: CharacterBuild = {
      ...build,
      levels: [{ ...build.levels[0]!, features: ["Fast Movement"] }],
    };
    const dupSheet = computeSheet(buildCharacter(dupBuild));
    expect(dupSheet.descriptor.features.map((f) => f.name)).toEqual([
      "Fast Movement",
      "Rage",
    ]);
  });
});
