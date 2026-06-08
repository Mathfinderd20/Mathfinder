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

  it("derives empty inventory totals by default", () => {
    expect(sheet.inventory).toEqual({
      itemCount: 0,
      equippedCount: 0,
      totalWeight: 0,
      totalCostGp: 0,
    });
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

describe("inventory math", () => {
  it("auto-sums carried weight and total cost from equipment quantities", () => {
    const build = grukkLevel1();
    build.equipment = [
      { name: "Backpack", weight: 2, costGp: 2, equipped: true },
      { name: "Torch", quantity: 3, weight: 1, costGp: 0.01 },
      { name: "Rope, hemp", weight: 10, costGp: 1 },
    ];
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.inventory).toEqual({
      itemCount: 5,
      equippedCount: 1,
      totalWeight: 15,
      totalCostGp: 3.03,
    });
    expect(sheet.encumbrance.carriedWeight).toBe(15);
  });

  it("lets manual carried weight override auto-summed gear weight", () => {
    const build = grukkLevel1();
    build.equipment = [{ name: "Anvil, tragically", weight: 10, costGp: 5 }];
    build.carriedWeight = 50;
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.inventory.totalWeight).toBe(10);
    expect(sheet.encumbrance.carriedWeight).toBe(50);
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
    build.levels[0]!.className = "Paladin"; // not in SAMPLE_CLASSES yet
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "unknown-class")).toBe(true);
  });

  it("flags prepared spell picks above prep capacity", () => {
    const build: CharacterBuild = {
      name: "Prep Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: {
          prepared: {
            1: ["mage armor", "magic missile", "shield"],
          },
        },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "prepared-spells-over-capacity")).toBe(true);
  });

  it("flags spontaneous known picks above known count", () => {
    const build: CharacterBuild = {
      name: "Known Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 },
      levels: [{ className: "Sorcerer", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        sorcerer: {
          known: {
            1: ["magic missile", "shield", "grease"],
          },
        },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spells-known-over-cap")).toBe(true);
  });

  it("flags unknown spell names in selections", () => {
    const build: CharacterBuild = {
      name: "Mystery Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 1: ["Orb of Taxes"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "unknown-spell")).toBe(true);
  });

  it("flags spells not on the class list", () => {
    const build: CharacterBuild = {
      name: "Heretical Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 1: ["Cure Light Wounds"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spell-not-on-class-list")).toBe(true);
  });

  it("flags spell level mismatches", () => {
    const build: CharacterBuild = {
      name: "Bucket Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 0: ["Magic Missile"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spell-level-mismatch")).toBe(true);
  });
});
