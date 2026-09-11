import { describe, expect, it } from "vitest";
import { buildCharacter, computeSheet } from "@mathfinder/rules-engine";
import { createFreshCharacterBuild } from "./newCharacterBuild";

const humanRace = {
  id: "human",
  name: "Human",
  size: "medium" as const,
  speed: 30,
  abilityModifiers: [],
  choiceOptions: { flexibleAbilityBonus: { value: 2 } },
};

describe("createFreshCharacterBuild", () => {
  it("supports choosing a later feat slot first and carries race, archetype and magic choices into the draft", () => {
    const feats: string[] = [];
    feats[1] = "Improved Initiative";
    const build = createFreshCharacterBuild("Draft", humanRace, {
      className: "Wizard",
      alignment: "true-neutral",
      hitPointRoll: 6,
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 16,
        wis: 10,
        cha: 10,
      },
      feats,
      alternateTraits: ["focused-study"],
      archetypes: ["test-archetype"],
      spellLibrary: { wizard: { 1: ["Shield"] } },
    });
    expect(build.levels[0]?.feats).toEqual(["Improved Initiative"]);
    expect(build.race.choiceSelection?.alternateTraits).toEqual([
      "focused-study",
    ]);
    expect(build.classArchetypes?.wizard).toEqual(["test-archetype"]);
    expect(build.spellLibrary?.wizard?.[1]).toEqual(["Shield"]);
  });
  it("creates a clean level-one build from creation decisions", () => {
    const build = createFreshCharacterBuild("  Merisiel  ", humanRace, {
      className: "Rogue",
      alignment: "chaotic-neutral",
      hitPointRoll: 8,
      baseAbilityScores: {
        str: 10,
        dex: 16,
        con: 12,
        int: 14,
        wis: 10,
        cha: 10,
      },
      flexibleAbility: "dex",
      raceBonusFeat: "Dodge",
      skillRanks: { acrobatics: 1, stealth: 1 },
      feats: ["Weapon Finesse"],
      favoredClass: "skill",
      favoredClassSelection: "Forest",
      ignoreAlignmentRestrictions: true,
      ignoreEncumbrance: true,
    });

    expect(build.name).toBe("Merisiel");
    expect(build.alignment).toBe("chaotic-neutral");
    expect(build.race.name).toBe("Human");
    expect(build.race.choiceSelection).toMatchObject({
      flexibleAbility: "dex",
      bonusFeat: "Dodge",
    });
    expect(build.favoredClassName).toBe("Rogue");
    expect(build.levels).toEqual([
      expect.objectContaining({
        className: "Rogue",
        hitPointRoll: 8,
        skillRanks: { acrobatics: 1, stealth: 1 },
        feats: ["Weapon Finesse"],
        favoredClass: "skill",
        favoredClassSelection: "Forest",
      }),
    ]);
    expect(build.weapons).toEqual([]);
    expect(build.equipment).toEqual([]);
    expect(build.coinPurse).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
    expect(build.carriedWeight).toBeUndefined();
    expect(build.campaignRules?.ignoreAlignmentRestrictions).toBe(true);
    expect(build.campaignRules?.ignoreEncumbrance).toBe(true);

    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.skills.acrobatics.ranks).toBe(1);
    expect(sheet.skills.stealth.ranks).toBe(1);
    expect(sheet.skills.acrobatics.total).toBeGreaterThan(
      sheet.abilities.dex.mod,
    );
  });
});
