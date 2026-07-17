import { describe, expect, it } from "vitest";
import {
  applyLevelUp,
  buildCharacter,
  createPreLevelBuild,
  planLevelUp,
  validateLevelUpSelection,
  type CharacterBuild,
} from "../src/build/character";
import { computeSheet } from "../src/compute";

function grukk(): CharacterBuild {
  return {
    name: "Grukk",
    race: {
      name: "Half-Orc",
      size: "medium",
      abilityModifiers: [
        { target: "str", type: "racial", value: 2, source: "Half-Orc" },
      ],
    },
    baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    levels: [{ className: "Barbarian", hitPointRoll: 12 }],
  };
}

function humanLearner(): CharacterBuild {
  return {
    name: "Ada",
    race: {
      id: "human",
      name: "Human",
      size: "medium",
      abilityModifiers: [],
      choiceOptions: {
        flexibleAbilityBonus: { value: 2 },
        extraSkillRanksPerLevel: 1,
      },
      choiceSelection: {
        flexibleAbility: "int",
      },
    },
    baseAbilityScores: { str: 10, dex: 12, con: 12, int: 14, wis: 10, cha: 8 },
    levels: [{ className: "Barbarian", hitPointRoll: 12 }],
  };
}

describe("planLevelUp", () => {
  it("computes skill points from class base + Int mod", () => {
    // Barbarian 4 + Int mod 0 = 4
    expect(planLevelUp(grukk(), "Barbarian").skillPoints).toBe(4);
  });

  it("grants a feat on odd levels but not even", () => {
    expect(planLevelUp(grukk(), "Barbarian").grantsFeat).toBe(false); // -> level 2
    const l2 = applyLevelUp(grukk(), {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: {},
    });
    expect(planLevelUp(l2, "Barbarian").grantsFeat).toBe(true); // -> level 3
  });

  it("grants an ability increase every 4th level", () => {
    let build = grukk();
    for (let i = 0; i < 2; i++) {
      build = applyLevelUp(build, {
        className: "Barbarian",
        hitPointRoll: 7,
        skillRanks: {},
      });
    }
    // build is now level 3; next plan -> level 4
    expect(planLevelUp(build, "Barbarian").grantsAbilityIncrease).toBe(true);
  });

  it("caps max ranks per skill at character level", () => {
    expect(planLevelUp(grukk(), "Barbarian").maxRanksPerSkill).toBe(2); // -> level 2
  });

  it("adds racial extra skill ranks per level into the budget", () => {
    expect(planLevelUp(humanLearner(), "Barbarian").skillPoints).toBe(8);
  });

  it("lets alternate racial traits remove base race choice benefits", () => {
    const build = humanLearner();
    build.race.alternateTraits = [
      {
        id: "heart-of-the-fields",
        name: "Heart of the Fields",
        description: "Removes skilled",
        replaces: ["Skilled"],
        removeChoiceOptions: ["extraSkillRanksPerLevel"],
      },
    ];
    build.race.choiceSelection = {
      flexibleAbility: "int",
      alternateTraits: ["heart-of-the-fields"],
    };
    expect(planLevelUp(build, "Barbarian").skillPoints).toBe(7);
  });
});

describe("validateLevelUpSelection", () => {
  const plan = planLevelUp(grukk(), "Barbarian"); // level 2, 4 skill points, no feat/ASI

  it("rejects spending more skill points than available", () => {
    const issues = validateLevelUpSelection(plan, {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: {
        climb: 1,
        swim: 1,
        perception: 1,
        survival: 1,
        intimidate: 1,
      },
    });
    expect(issues.some((i) => i.code === "skill-points-over-budget")).toBe(
      true,
    );
  });

  it("rejects more than one rank in a skill per level", () => {
    const issues = validateLevelUpSelection(plan, {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: { climb: 2 },
    });
    expect(issues.some((i) => i.code === "skill-ranks-per-level")).toBe(true);
  });

  it("rejects an ability increase when the level does not grant one", () => {
    const issues = validateLevelUpSelection(plan, {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: {},
      abilityIncrease: "str",
    });
    expect(issues.some((i) => i.code === "illegal-ability-increase")).toBe(
      true,
    );
  });

  it("accepts a legal selection", () => {
    const issues = validateLevelUpSelection(plan, {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
    });
    expect(issues).toEqual([]);
  });
});

describe("createPreLevelBuild", () => {
  it("stages a preview build with the chosen class and stat increase before commit", () => {
    let build = grukk();
    for (let i = 0; i < 2; i++) {
      build = applyLevelUp(build, {
        className: "Barbarian",
        hitPointRoll: 7,
        skillRanks: {},
      });
    }
    const preview = createPreLevelBuild(build, {
      className: "Barbarian",
      abilityIncrease: "str",
    });
    const sheet = computeSheet(buildCharacter(preview.build));
    expect(preview.plan.characterLevel).toBe(4);
    expect(preview.selection.hitPointRoll).toBe(preview.plan.averageHitPoints);
    expect(sheet.level).toBe(4);
    expect(sheet.abilities.str.score).toBe(17);
  });
});

describe("applyLevelUp feeds computeSheet", () => {
  it("advances the sheet with the chosen ability increase at level 4", () => {
    let build = grukk();
    for (let i = 0; i < 2; i++) {
      build = applyLevelUp(build, {
        className: "Barbarian",
        hitPointRoll: 7,
        skillRanks: {},
      });
    }
    build = applyLevelUp(build, {
      className: "Barbarian",
      hitPointRoll: 7,
      skillRanks: {},
      abilityIncrease: "str",
    });
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.level).toBe(4);
    expect(sheet.abilities.str.score).toBe(17); // 14 base + 2 racial + 1 ASI
  });
});
