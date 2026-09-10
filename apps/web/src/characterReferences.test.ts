import { describe, expect, it } from "vitest";
import {
  buildClassFeatureRegistry,
  buildFeatRegistry,
  computeSheet,
  CORE_CLASS_FEATURES,
  CORE_FEATS,
} from "@mathfinder/rules-engine";
import {
  characterReferences,
  referenceDetails,
  restorableAbilityResourceIds,
} from "./characterReferences";
import { effectDisposition } from "./runtimeInsights";
const sheet = computeSheet({
  name: "Rows",
  level: 5,
  size: "medium",
  abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
  baseAttackBonus: 5,
  baseSaves: { fort: 0, ref: 0, will: 0 },
  modifiers: [],
  raceMetadata: { notes: ["Orc Blood: Counts as human and orc."] },
  descriptor: {
    classes: [{ name: "Barbarian", level: 5 }],
    feats: [{ name: "Power Attack", level: 1 }],
    features: [
      { name: "Rage", level: 1 },
      { name: "Rage", level: 3 },
    ],
    archetypes: [],
    suppressedFeatures: [],
  },
});
describe("character reference rows", () => {
  it("puts traits first and connects feats and features to canonical rail IDs", () => {
    const groups = characterReferences(
      sheet,
      ["Brave: +1 against fear."],
      buildClassFeatureRegistry(CORE_CLASS_FEATURES),
      buildFeatRegistry(CORE_FEATS),
    );
    expect(groups.map((group) => group.name)).toEqual([
      "Traits",
      "Feats",
      "Special Abilities",
    ]);
    expect(groups[0]!.rows[0]!.description).toBe("Counts as human and orc.");
    expect(groups[1]!.rows[0]!.activation?.id).toBe("power-attack");
    expect(groups[2]!.rows).toHaveLength(1);
    expect(groups[2]!.rows[0]!.resourceId).toBe("rage");
  });
  it("resets ability resources without replenishing spell durations", () => {
    expect(
      restorableAbilityResourceIds(
        { rage: 8, "cleric-channel-energy": 5, "spell-bless": 5 },
        ["spell-bless"],
      ),
    ).toEqual(["rage", "cleric-channel-energy"]);
  });
  it("extracts supplied dice and DC without guessing missing values", () => {
    expect(referenceDetails("Deal 2d6+3, Fort DC 16 negates.")).toEqual([
      "2d6+3",
      "DC 16",
    ]);
    expect(referenceDetails("Passive racial trait.")).toEqual([]);
  });
  it("gives detrimental effects red semantics and keeps mixed effects neutral", () => {
    expect(effectDisposition({ name: "Fatigued" })).toBe("detrimental");
    expect(effectDisposition({ name: "Bless" })).toBe("beneficial");
    expect(
      effectDisposition({
        name: "Tradeoff",
        effects: [{ value: 2 }, { value: -1 }],
      }),
    ).toBe("neutral");
    expect(effectDisposition({ name: "Unknown" })).toBe("neutral");
  });
});
