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
    const features = classFeaturesGrantedAt(CLASS_FEATURES, "Barbarian", 1).map((f) => f.name);
    expect(features).toEqual(["Fast Movement", "Rage"]);
  });
});

describe("class feature effects auto-apply through buildCharacter", () => {
  const build: CharacterBuild = {
    name: "Grukk",
    race: {
      name: "Half-Orc",
      size: "medium",
      speed: 30,
      abilityModifiers: [{ target: "str", type: "racial", value: 2, source: "Half-Orc" }],
    },
    baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    levels: [{ className: "Barbarian", hitPointRoll: 12, feats: ["Toughness"] }],
  };
  const sheet = computeSheet(buildCharacter(build));

  it("surfaces auto-granted class features on the descriptor", () => {
    expect(sheet.descriptor.features.map((f) => f.name)).toEqual(["Fast Movement", "Rage"]);
  });

  it("applies passive feature effects like Fast Movement", () => {
    expect(sheet.speed.total).toBe(40); // 30 base + 10 Fast Movement
    expect(sheet.encumbrance.band).toBe("light");
  });

  it("resolves Rage as an activatable class feature from the descriptor", () => {
    expect(activatableFeaturesForDescriptor(CLASS_FEATURES, sheet.descriptor).map((f) => f.name)).toEqual(["Rage"]);
  });

  it("exposes Rage rounds/day as a resource pool (4 + Con + 2/level after 1st)", () => {
    const rage = CORE_CLASS_FEATURES.find((f) => f.id === "barbarian-rage-l1")!.activatable!;
    const max = activatableResourceMax(rage, {
      baseAttackBonus: 1,
      characterLevel: 1,
      abilityModifiers: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: -1 },
    });
    expect(max).toBe(6); // 4 + Con 2 + 0
  });

  it("suppresses Fast Movement in medium armor or heavy load", () => {
    const mediumArmorBuild: CharacterBuild = {
      ...build,
      equipment: [{ name: "Scale mail", armor: { category: "medium", speedPenalty: 10 } }],
    };
    const mediumArmorSheet = computeSheet(buildCharacter(mediumArmorBuild));
    expect(mediumArmorSheet.speed.total).toBe(20); // 30 base - 10 armor, no Fast Movement
    expect(mediumArmorSheet.descriptor.suppressedFeatures).toEqual([
      { name: "Fast Movement", level: 1, reason: "medium armor" },
    ]);

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
    expect(dupSheet.descriptor.features.map((f) => f.name)).toEqual(["Fast Movement", "Rage"]);
  });
});
