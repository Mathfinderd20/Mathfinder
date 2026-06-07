import { describe, expect, it } from "vitest";
import {
  CLASS_FEATURES,
  classFeaturesGrantedAt,
} from "../src/content/class-features";
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
  });
});
