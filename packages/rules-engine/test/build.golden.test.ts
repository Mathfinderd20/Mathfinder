import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import {
  buildCharacter,
  levelDown,
  levelUp,
  validateBuild,
  type CharacterBuild,
  type LevelEntry,
} from "../src/build/character";

/** A fresh level-1 Half-Orc Barbarian built from scratch. */
function grukkLevel1(): CharacterBuild {
  return {
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
      {
        className: "Barbarian",
        hitPointRoll: 12,
        skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
        feats: ["Toughness"], // +3 HP auto-applied from the feat registry
      },
    ],
  };
}

describe("buildCharacter + computeSheet (level 1)", () => {
  const sheet = computeSheet(buildCharacter(grukkLevel1()));

  it("applies racial ability bonus into the derived score", () => {
    expect(sheet.abilities.str.score).toBe(16); // 14 base + 2 racial
    expect(sheet.abilities.str.mod).toBe(3);
  });

  it("derives BAB and saves from the class progression", () => {
    expect(sheet.baseAttackBonus).toBe(1); // full BAB
    expect(sheet.saves.fort.total).toBe(4); // good save base 2 + Con 2
    expect(sheet.saves.ref.total).toBe(1); // poor 0 + Dex 1
    expect(sheet.saves.will.total).toBe(1); // poor 0 + Wis 1
  });

  it("computes HP from the rolled hit die plus Toughness", () => {
    expect(sheet.hitPoints.total).toBe(17); // max(1, 12 + 2) + 3
  });

  it("treats class skills correctly with the +3 bonus", () => {
    expect(sheet.skills.climb.total).toBe(7); // 1 rank + STR 3 + class 3
    expect(sheet.skills.perception.total).toBe(5); // 1 + WIS 1 + class 3
    expect(sheet.skills.intimidate.total).toBe(3); // 1 + CHA -1 + class 3
  });

  it("reports no validation issues for a legal build", () => {
    expect(validateBuild(grukkLevel1())).toEqual([]);
  });

  it("surfaces race, class, and feats on the sheet descriptor", () => {
    expect(sheet.descriptor.race).toBe("Half-Orc");
    expect(sheet.descriptor.classes).toEqual([{ name: "Barbarian", level: 1 }]);
    expect(sheet.descriptor.feats).toEqual([{ name: "Toughness", level: 1 }]);
  });
});

describe("levelUp to level 2", () => {
  const level2: LevelEntry = {
    className: "Barbarian",
    hitPointRoll: 7,
    skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
  };
  const build = levelUp(grukkLevel1(), level2);
  const sheet = computeSheet(buildCharacter(build));

  it("advances BAB and the good Fort save", () => {
    expect(sheet.baseAttackBonus).toBe(2);
    expect(sheet.saves.fort.total).toBe(5); // good base 3 + Con 2
  });

  it("accumulates hit points across both levels", () => {
    expect(sheet.hitPoints.total).toBe(26); // 14 + 9 + Toughness 3
  });

  it("stacks skill ranks toward the per-level cap", () => {
    expect(sheet.skills.climb.total).toBe(8); // 2 ranks + STR 3 + class 3
  });

  it("levelDown undoes the level cleanly", () => {
    const reverted = levelDown(build);
    expect(reverted.levels).toHaveLength(1);
    expect(computeSheet(buildCharacter(reverted)).baseAttackBonus).toBe(1);
  });
});

describe("validateBuild catches illegal builds", () => {
  it("flags skill ranks above the per-level cap", () => {
    const build = grukkLevel1();
    build.levels[0]!.skillRanks = { climb: 2 }; // 2 ranks at level 1
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "skill-ranks-over-cap")).toBe(true);
  });

  it("flags an ability increase outside levels 4/8/12", () => {
    const build = grukkLevel1();
    build.levels[0]!.abilityIncrease = "str";
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "illegal-ability-increase")).toBe(true);
  });

  it("flags an unknown class", () => {
    const build = grukkLevel1();
    build.levels[0]!.className = "Sorcerer"; // not in SAMPLE_CLASSES
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "unknown-class")).toBe(true);
  });
});
