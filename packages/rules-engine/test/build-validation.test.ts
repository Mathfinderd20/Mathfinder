import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import {
  buildCharacter,
  validateBuild,
  type CharacterBuild,
} from "../src/build/character";
import { SAMPLE_CLASSES, type ClassRegistry } from "../src/build/classes";
import { FEATS, type FeatRegistry } from "../src/content/feats";

function baseBuild(): CharacterBuild {
  return {
    name: "Packmule",
    race: {
      name: "Human",
      size: "medium",
      abilityModifiers: [],
    },
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [{ className: "Fighter", hitPointRoll: 10 }],
    coinPurse: { gp: 10 },
    equipment: [],
  };
}

const PRESTIGE_CLASSES: ClassRegistry = {
  ...SAMPLE_CLASSES,
  "eldritch knight": {
    name: "Eldritch Knight",
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort"],
    skillRanksPerLevel: 2,
    classSkills: ["climb", "knowledge.arcana", "ride", "spellcraft"],
    weaponProficiencies: ["simple", "martial"],
    isPrestigeClass: true,
    prerequisites: [
      { type: "bab", min: 5, description: "BAB +5" },
      {
        type: "skill-ranks",
        skill: "knowledge.arcana",
        min: 5,
        description: "Knowledge (arcana) 5 ranks",
      },
      {
        type: "feat",
        featName: "Weapon Focus",
        description: "Weapon Focus",
      },
    ],
  },
};

const SELF_PREREQ_FEATS: FeatRegistry = {
  ...FEATS,
  "self-prereq-feat": {
    id: "self-prereq-feat",
    name: "Self Prereq Feat",
    pack: "test",
    description:
      "Bad content feat that incorrectly names itself as a prerequisite.",
    prerequisites: [
      {
        type: "feat",
        featName: "Self Prereq Feat",
        description: "Self Prereq Feat",
      },
    ],
    effects: [],
  },
};

describe("validateBuild level diagnostics", () => {
  it("enforces class alignment restrictions and carries alignment to the sheet", () => {
    const lawfulBarbarian = baseBuild();
    lawfulBarbarian.alignment = "lawful-neutral";
    lawfulBarbarian.levels = [{ className: "Barbarian", hitPointRoll: 12 }];

    expect(validateBuild(lawfulBarbarian)).toContainEqual(
      expect.objectContaining({
        code: "class-alignment-restriction",
        severity: "error",
        level: 1,
      }),
    );

    lawfulBarbarian.alignment = "chaotic-neutral";
    expect(
      validateBuild(lawfulBarbarian).some(
        (issue) => issue.code === "class-alignment-restriction",
      ),
    ).toBe(false);
    expect(
      computeSheet(buildCharacter(lawfulBarbarian)).descriptor.alignment,
    ).toBe("chaotic-neutral");
  });

  it("enforces paladin and druid alignment restrictions", () => {
    const build = baseBuild();
    build.alignment = "neutral-good";
    build.levels = [{ className: "Paladin", hitPointRoll: 10 }];
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "class-alignment-restriction",
    );

    build.alignment = "lawful-good";
    expect(validateBuild(build).map((issue) => issue.code)).not.toContain(
      "class-alignment-restriction",
    );

    build.levels = [{ className: "Druid", hitPointRoll: 8 }];
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "class-alignment-restriction",
    );
    build.alignment = "true-neutral";
    expect(validateBuild(build).map((issue) => issue.code)).not.toContain(
      "class-alignment-restriction",
    );
  });

  it("rejects hit-point rolls outside the class hit die", () => {
    const build = baseBuild();
    build.levels[0]!.hitPointRoll = 11;
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "invalid-hit-point-roll",
    );
  });
});

describe("validateBuild inventory diagnostics", () => {
  it("warns when the wishlist costs more than the available coin purse", () => {
    const build = baseBuild();
    build.equipment = [
      {
        name: "Mithral dreams",
        quantity: 1,
        costGp: 25,
        ownership: "wishlist",
      },
    ];

    const issues = validateBuild(build);
    expect(issues.some((issue) => issue.code === "wishlist-over-budget")).toBe(
      true,
    );
  });

  it("flags missing, duplicate, and overloaded containers", () => {
    const build = baseBuild();
    build.equipment = [
      {
        name: "Backpack",
        quantity: 1,
        weight: 2,
        costGp: 2,
        ownership: "owned",
        containerCapacityLb: 5,
      },
      {
        name: "Backpack",
        quantity: 1,
        weight: 2,
        costGp: 2,
        ownership: "owned",
        containerCapacityLb: 10,
      },
      {
        name: "Rope",
        quantity: 1,
        weight: 6,
        costGp: 1,
        ownership: "owned",
        containerName: "Backpack",
      },
      {
        name: "Torch",
        quantity: 1,
        weight: 1,
        costGp: 0.01,
        ownership: "owned",
        containerName: "Missing Sack",
      },
    ];

    const issues = validateBuild(build);
    expect(
      issues.some((issue) => issue.code === "duplicate-container-name"),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.code === "missing-container-reference"),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.code === "container-over-capacity"),
    ).toBe(true);
  });

  it("errors when an item tries to contain itself", () => {
    const build = baseBuild();
    build.equipment = [
      {
        name: "Backpack",
        quantity: 1,
        weight: 2,
        costGp: 2,
        ownership: "owned",
        containerCapacityLb: 30,
        containerName: "Backpack",
      },
    ];

    const issues = validateBuild(build);
    expect(issues.some((issue) => issue.code === "self-contained-item")).toBe(
      true,
    );
  });

  it("applies parameterized Weapon Focus and Skill Focus effects", () => {
    const build: CharacterBuild = {
      ...baseBuild(),
      baseAbilityScores: {
        str: 16,
        dex: 12,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { perception: 1 },
          feats: ["Weapon Focus (Longsword)", "Skill Focus (Perception)"],
        },
      ],
      weapons: [
        {
          name: "Longsword",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d8",
        },
        {
          name: "Battleaxe",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d8",
        },
      ],
    };
    const sheet = computeSheet(buildCharacter(build));
    const longsword = sheet.weapons.find(
      (weapon) => weapon.name === "Longsword",
    );
    const battleaxe = sheet.weapons.find(
      (weapon) => weapon.name === "Battleaxe",
    );
    expect(longsword?.attack.total).toBe((battleaxe?.attack.total ?? 0) + 1);
    expect(sheet.skills.perception?.total).toBe(4);
  });

  it("flags missing feat parameters and duplicate non-repeatable feats", () => {
    const build: CharacterBuild = {
      ...baseBuild(),
      levels: [
        {
          className: "Fighter",
          hitPointRoll: 10,
          feats: ["Weapon Focus", "Toughness", "Toughness"],
        },
      ],
    };
    const issues = validateBuild(build);
    expect(
      issues.some((issue) => issue.code === "feat-parameter-missing"),
    ).toBe(true);
    expect(issues.some((issue) => issue.code === "duplicate-feat")).toBe(true);
  });

  it("ignores self-referential feat prerequisites from bad content", () => {
    const build: CharacterBuild = {
      ...baseBuild(),
      levels: [
        {
          className: "Fighter",
          hitPointRoll: 10,
          feats: ["Self Prereq Feat"],
        },
      ],
    };
    const issues = validateBuild(
      build,
      undefined,
      undefined,
      undefined,
      SELF_PREREQ_FEATS,
    );
    expect(
      issues.some(
        (issue) =>
          issue.code === "feat-prerequisites" &&
          issue.message.includes("Self Prereq Feat"),
      ),
    ).toBe(false);
  });

  it("flags unmet prestige-class prerequisites on first entry", () => {
    const build: CharacterBuild = {
      ...baseBuild(),
      levels: [{ className: "Eldritch Knight", hitPointRoll: 10 }],
    };
    const issues = validateBuild(build, PRESTIGE_CLASSES, undefined);
    expect(
      issues.some((issue) => issue.code === "prestige-class-prerequisites"),
    ).toBe(true);
  });

  it("accepts an ancestry-specific favored-class bonus and rejects unknown ones", () => {
    const valid: CharacterBuild = {
      ...baseBuild(),
      race: {
        name: "Half-Orc",
        size: "medium",
        favoredClassBonuses: [
          {
            id: "orc-fighter-death-threshold",
            className: "Fighter",
            label: "Orc resilience",
            description: "Death threshold",
            deathThresholdBonus: 2,
          },
        ],
      },
      favoredClassName: "Fighter",
      levels: [
        {
          className: "Fighter",
          hitPointRoll: 10,
          favoredClass: "orc-fighter-death-threshold",
        },
      ],
    };
    expect(
      validateBuild(valid, PRESTIGE_CLASSES).some(
        (issue) => issue.code === "unknown-favored-class-bonus",
      ),
    ).toBe(false);

    valid.levels[0]!.favoredClass = "invented-bonus";
    expect(
      validateBuild(valid, PRESTIGE_CLASSES).some(
        (issue) => issue.code === "unknown-favored-class-bonus",
      ),
    ).toBe(true);
  });

  it("allows prestige-class entry once prerequisites are met", () => {
    const build: CharacterBuild = {
      ...baseBuild(),
      baseAbilityScores: {
        str: 16,
        dex: 12,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { "knowledge.arcana": 1 },
        },
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { "knowledge.arcana": 1 },
        },
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { "knowledge.arcana": 1 },
          feats: ["Weapon Focus (Longsword)"],
        },
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { "knowledge.arcana": 1 },
        },
        {
          className: "Fighter",
          hitPointRoll: 10,
          skillRanks: { "knowledge.arcana": 1 },
        },
        { className: "Eldritch Knight", hitPointRoll: 10 },
      ],
    };
    const issues = validateBuild(build, PRESTIGE_CLASSES, undefined);
    expect(
      issues.some((issue) => issue.code === "prestige-class-prerequisites"),
    ).toBe(false);
  });
});
