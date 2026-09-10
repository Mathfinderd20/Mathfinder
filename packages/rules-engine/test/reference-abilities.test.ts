import { describe, expect, it } from "vitest";
import {
  computeSheet,
  referenceAbilityMechanics,
  activatableResourceMax,
  CORE_CLASS_FEATURES,
} from "../src";
const sheet = computeSheet({
  name: "Multiclass",
  level: 10,
  size: "medium",
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 14 },
  baseAttackBonus: 5,
  baseSaves: { fort: 0, ref: 0, will: 0 },
  modifiers: [],
  descriptor: {
    classes: [
      { name: "Cleric", level: 5 },
      { name: "Wizard", level: 5 },
    ],
    features: [],
    feats: [],
    archetypes: [],
    suppressedFeatures: [],
  },
});
describe("reference ability math", () => {
  it("restores Rage's counter from serialized content and uses barbarian levels only", () => {
    const rage = CORE_CLASS_FEATURES.find(
      (feature) => feature.name === "Rage",
    )!.activatable!;
    const context = {
      characterLevel: 10,
      baseAttackBonus: 7,
      classLevels: { barbarian: 1, cleric: 9 },
      abilityModifiers: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    };
    expect(activatableResourceMax(rage, context)).toBe(6);
    expect(
      activatableResourceMax(JSON.parse(JSON.stringify(rage)), context),
    ).toBe(6);
  });
  it("uses cleric level, not character level, for channel DC and dice", () => {
    const ability = referenceAbilityMechanics(
      "Channel Energy",
      "cleric",
      sheet,
    );
    expect(ability.details).toEqual(["3d6", "Will DC 14"]);
    expect(ability.pool?.max).toBe(5);
  });
  it("includes channel feats and clamps an exhausted maximum", () => {
    const improved = {
      ...sheet,
      descriptor: {
        ...sheet.descriptor,
        feats: [
          { name: "Extra Channel", level: 1 },
          { name: "Improved Channel", level: 3 },
        ],
      },
    };
    expect(
      referenceAbilityMechanics("Channel Energy", "cleric", improved).details,
    ).toContain("Will DC 16");
    expect(
      referenceAbilityMechanics("Channel Energy", "cleric", improved).pool?.max,
    ).toBe(7);
  });
  it("does not invent counters for unknown content", () => {
    expect(referenceAbilityMechanics("Mystery", "wizard", sheet)).toEqual({
      details: [],
    });
    expect(
      referenceAbilityMechanics("Channel Energy", "wizard", sheet),
    ).toEqual({ details: [] });
  });
  it("combines monk levels with one use per four non-monk levels", () => {
    const monk = {
      ...sheet,
      descriptor: {
        ...sheet.descriptor,
        classes: [
          { name: "Monk", level: 5 },
          { name: "Fighter", level: 5 },
        ],
      },
    };
    const ability = referenceAbilityMechanics("Stunning Fist", undefined, monk);
    expect(ability.pool?.max).toBe(6);
    expect(ability.details).toEqual(["Fort DC 18"]);
  });
  it("floors paladin levels before adding Charisma", () => {
    const paladin = {
      ...sheet,
      descriptor: {
        ...sheet.descriptor,
        classes: [
          { name: "Paladin", level: 5 },
          { name: "Wizard", level: 5 },
        ],
      },
    };
    const ability = referenceAbilityMechanics(
      "Lay on Hands",
      "paladin",
      paladin,
    );
    expect(ability.pool?.max).toBe(4);
    expect(ability.details).toEqual(["2d6"]);
  });
});
