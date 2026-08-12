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
  it("creates a clean level-one build from creation decisions", () => {
    const build = createFreshCharacterBuild("  Merisiel  ", humanRace, {
      className: "Rogue",
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
    });

    expect(build.name).toBe("Merisiel");
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
      }),
    ]);
    expect(build.weapons).toEqual([]);
    expect(build.equipment).toEqual([]);
    expect(build.coinPurse).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });

    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.skills.acrobatics.ranks).toBe(1);
    expect(sheet.skills.stealth.ranks).toBe(1);
    expect(sheet.skills.acrobatics.total).toBeGreaterThan(
      sheet.abilities.dex.mod,
    );
  });
});
