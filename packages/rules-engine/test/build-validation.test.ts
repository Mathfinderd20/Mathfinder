import { describe, expect, it } from "vitest";
import { validateBuild, type CharacterBuild } from "../src/build/character";

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
});
