import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import {
  allocateTotalSkillRanks,
  continuedSkillKeys,
  continuedSkillRanksForLevel,
  totalAllocatedSkillRanks,
  totalSkillRankBudget,
  totalSkillRanks,
} from "./skillRankProgression";

const fighter = [{ name: "Fighter", skillRanksPerLevel: 2 }];

function testBuild(): CharacterBuild {
  return {
    name: "Rank Tester",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [
      {
        className: "Fighter",
        hitPointRoll: 10,
        skillRanks: { perception: 1, acrobatics: 1 },
      },
      { className: "Fighter", hitPointRoll: 6, skillRanks: {} },
      { className: "Fighter", hitPointRoll: 6, skillRanks: {} },
    ],
  };
}

describe("character skill-rank allocation", () => {
  it("reports one total pool across every planned level", () => {
    const build = testBuild();
    expect(totalSkillRankBudget(build, fighter)).toBe(6);
    expect(totalAllocatedSkillRanks(build)).toBe(2);
    expect(totalSkillRanks(build, "perception")).toBe(1);
  });

  it("distributes an edited total across legal per-level budgets", () => {
    const result = allocateTotalSkillRanks(
      testBuild(),
      fighter,
      "perception",
      3,
    );
    expect(
      result.levels.map((level) => level.skillRanks?.perception ?? 0),
    ).toEqual([1, 1, 1]);
    expect(totalSkillRanks(result, "perception")).toBe(3);
  });

  it("continues previously trained skills when a planner level is added", () => {
    const build = testBuild();
    expect(continuedSkillRanksForLevel(build, fighter, 1)).toEqual({
      acrobatics: 1,
      perception: 1,
    });
  });

  it("limits modal continuation to the new level's available points", () => {
    const build = testBuild();
    expect(continuedSkillKeys(build, 1, 1)).toEqual(["acrobatics"]);
  });
});
