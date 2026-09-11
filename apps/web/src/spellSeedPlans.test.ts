import { describe, expect, it } from "vitest";
import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import {
  applySpellSeedPlans,
  buildSpellSeedGroups,
  buildSpellSeedPlans,
  spellSeedKey,
  spellSeedSelectionsAreComplete,
} from "./spellSeedPlans";

function caster(
  className: string,
  castingType: "prepared" | "spontaneous",
): DerivedSpellcasting {
  return {
    className,
    castingType,
    selectionDiagnostics: {
      0: { capacity: 2 },
      1: { capacity: 1 },
    },
  } as unknown as DerivedSpellcasting;
}

const choices = {
  wizard: {
    0: [
      { spellName: "Detect Magic", reason: "Useful", score: 80 },
      { spellName: "Light", reason: "Useful", score: 70 },
    ],
    1: [{ spellName: "Magic Missile", reason: "Reliable", score: 90 }],
  },
  bard: {
    0: [{ spellName: "Dancing Lights", reason: "Useful", score: 70 }],
  },
};

describe("initial spell seed plans", () => {
  it("prompts supported full casters but not partial casters", () => {
    const groups = buildSpellSeedGroups(
      [caster("Wizard", "prepared"), caster("Bard", "spontaneous")],
      choices,
      { fullCastersOnly: true },
    );

    expect(groups.map((group) => group.className)).toEqual([
      "Wizard",
      "Wizard",
    ]);
  });

  it("requires every offered initial slot and creates persisted plans", () => {
    const groups = buildSpellSeedGroups(
      [caster("Wizard", "prepared")],
      choices,
      { fullCastersOnly: true },
    );
    const selections = {
      [spellSeedKey("wizard", 0, "Detect Magic")]: true,
      [spellSeedKey("wizard", 0, "Light")]: true,
      [spellSeedKey("wizard", 1, "Magic Missile")]: true,
    } as const;

    expect(spellSeedSelectionsAreComplete(groups, {})).toBe(false);
    expect(spellSeedSelectionsAreComplete(groups, selections)).toBe(true);
    expect(buildSpellSeedPlans(groups, selections)).toEqual([
      {
        classKey: "wizard",
        mode: "prepared",
        level: 0,
        spells: ["Detect Magic", "Light"],
      },
      {
        classKey: "wizard",
        mode: "prepared",
        level: 1,
        spells: ["Magic Missile"],
      },
    ]);
  });

  it("adds initial choices to the spell library and selection state", () => {
    const build = applySpellSeedPlans({} as CharacterBuild, [
      {
        classKey: "sorcerer",
        mode: "known",
        level: 1,
        spells: ["Magic Missile"],
      },
    ]);

    expect(build.spellLibrary?.sorcerer?.[1]).toEqual(["Magic Missile"]);
    expect(build.spellSelections?.sorcerer?.known?.[1]).toEqual([
      "Magic Missile",
    ]);
  });
});
