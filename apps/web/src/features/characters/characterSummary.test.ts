import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import type { CharacterRecord } from "./characterRepository";
import { summarizeCharacter } from "./characterSummary";

function record(build: CharacterBuild, currentLevel: number): CharacterRecord {
  return {
    id: "hero-1",
    name: build.name,
    build,
    currentLevel,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
  };
}

function level(className: string) {
  return {
    className,
    hitPointRoll: 8,
    skillRanks: {},
    feats: [],
    modifiers: [],
  };
}

describe("summarizeCharacter", () => {
  it("summarizes multiclass levels up to the current level", () => {
    const summary = summarizeCharacter(
      record(
        {
          name: "Seelah",
          race: { name: "Human", size: "medium", speed: 30 },
          baseAbilityScores: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10,
          },
          levels: [level("Paladin"), level("Paladin"), level("Fighter")],
        },
        2,
      ),
      new Date("2026-08-03T12:00:00.000Z"),
    );

    expect(summary).toEqual({
      ancestry: "Human",
      classes: "Paladin 2",
      levelLabel: "Level 2",
      updatedLabel: "Edited yesterday",
    });
  });

  it("uses useful fallbacks for incomplete characters", () => {
    const summary = summarizeCharacter(
      record(
        {
          name: "Work in progress",
          race: { name: "", size: "medium", speed: 30 },
          baseAbilityScores: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10,
          },
          levels: [],
        },
        1,
      ),
      new Date("2026-08-02T18:00:00.000Z"),
    );

    expect(summary.ancestry).toBe("Unknown ancestry");
    expect(summary.classes).toBe("No class selected");
    expect(summary.updatedLabel).toBe("Edited today");
  });
});
