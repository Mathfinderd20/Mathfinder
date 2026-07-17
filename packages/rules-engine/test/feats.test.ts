import { describe, expect, it } from "vitest";
import {
  checkPrerequisites,
  featContextFromSheet,
  FEATS,
  getFeat,
  listFeats,
  type FeatContext,
} from "../src/content/feats";
import { CLASS_FEATURES } from "../src/content/class-features";
import {
  activatableModifiers,
  collectActivatableEffects,
} from "../src/content/activatables";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { computeSheet } from "../src/compute";

const baseCtx: FeatContext = {
  baseAttackBonus: 0,
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  characterLevel: 1,
  featNames: [],
};

describe("feat prerequisites", () => {
  it("passes a feat with no prerequisites", () => {
    expect(checkPrerequisites(getFeat(FEATS, "Toughness")!, baseCtx).met).toBe(
      true,
    );
  });

  it("blocks Dodge without Dex 13 and reports the reason", () => {
    const result = checkPrerequisites(getFeat(FEATS, "Dodge")!, baseCtx);
    expect(result.met).toBe(false);
    expect(result.unmet[0]?.description).toBe("Dex 13");
  });

  it("allows Power Attack only with Str 13 and BAB +1", () => {
    expect(
      checkPrerequisites(getFeat(FEATS, "Power Attack")!, baseCtx).met,
    ).toBe(false);
    const ctx: FeatContext = {
      ...baseCtx,
      baseAttackBonus: 1,
      abilityScores: { ...baseCtx.abilityScores, str: 13 },
    };
    expect(checkPrerequisites(getFeat(FEATS, "Power Attack")!, ctx).met).toBe(
      true,
    );
  });

  it("lists feats alphabetically", () => {
    const names = listFeats(FEATS).map((f) => f.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("feat effects auto-apply through buildCharacter", () => {
  const build: CharacterBuild = {
    name: "Test",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    levels: [
      {
        className: "Fighter",
        hitPointRoll: 10,
        feats: ["Toughness", "Iron Will"],
      },
    ],
  };
  const sheet = computeSheet(buildCharacter(build));

  it("applies Toughness HP from the registry (no hand-written modifier)", () => {
    // max(1, 10 + Con 1) = 11, + Toughness 3 = 14
    expect(sheet.hitPoints.total).toBe(14);
  });

  it("applies Iron Will to the Will save", () => {
    // base 2 (Fighter good Fort only -> Will poor 0) + Wis 0 + Iron Will 2 = 2
    expect(sheet.saves.will.total).toBe(2);
  });

  it("builds a feat context from the sheet", () => {
    const ctx = featContextFromSheet(sheet);
    expect(ctx.baseAttackBonus).toBe(1);
    expect(ctx.featNames).toContain("Toughness");
  });

  it("Power Attack activatable scales its melee penalty by BAB", () => {
    const pa = getFeat(FEATS, "Power Attack")!.activatable!;
    expect(
      activatableModifiers(pa, { baseAttackBonus: 1, characterLevel: 1 })[0]!
        .value,
    ).toBe(-1);
    expect(
      activatableModifiers(pa, { baseAttackBonus: 8, characterLevel: 8 })[0]!
        .value,
    ).toBe(-3);
  });

  it("can expose activatable feats through the general collector", () => {
    const descriptor = {
      race: "Human",
      classes: [{ name: "Fighter", level: 1 }],
      archetypes: [],
      feats: [{ name: "Combat Expertise", level: 1 }],
      features: [],
      suppressedFeatures: [],
    };
    expect(
      collectActivatableEffects({
        descriptor,
        classFeatureRegistry: CLASS_FEATURES,
        featRegistry: FEATS,
      }).map((a) => a.name),
    ).toEqual(["Combat Expertise"]);
  });
});
