import { describe, expect, it } from "vitest";
import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import {
  applySpellSeedPlans,
  buildSpellbookGrantGroups,
  buildSpellbookGrantPlans,
  buildSpellSeedGroups,
  buildSpellSeedPlans,
  classFeaturesIncludeSpellbook,
  selectedSpellCount,
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
    librarySpells: {},
    selectedKnownSpells: {},
    selectedPreparedSpells: {},
    selectionDiagnostics: {
      0: {
        capacity: 2,
        canCastLevel: true,
        availableSpellNames: ["Detect Magic", "Light"],
      },
      1: {
        capacity: 1,
        canCastLevel: true,
        availableSpellNames: ["Burning Hands", "Magic Missile"],
      },
    },
  } as unknown as DerivedSpellcasting;
}

const choices = {
  wizard: {
    0: [
      { spellName: "Detect Magic", reason: "Useful", score: 80 },
      { spellName: "Light", reason: "Useful", score: 70 },
    ],
    1: [
      { spellName: "Magic Missile", reason: "Reliable", score: 90 },
      { spellName: "Burning Hands", reason: "Useful", score: 80 },
    ],
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

  it("identifies spellbook classes from their class feature", () => {
    expect(classFeaturesIncludeSpellbook([{ name: "Spellbooks" }])).toBe(true);
    expect(classFeaturesIncludeSpellbook([{ name: "Spells" }])).toBe(false);
    expect(classFeaturesIncludeSpellbook(undefined)).toBe(false);
  });

  it("grants two selected non-cantrip spells without preparing them", () => {
    const groups = buildSpellbookGrantGroups(
      caster("Wizard", "prepared"),
      choices.wizard,
    );
    const selections = {
      [spellSeedKey("wizard", 1, "Magic Missile")]: true,
      [spellSeedKey("wizard", 1, "Burning Hands")]: true,
    } as const;
    const plans = buildSpellbookGrantPlans(groups, selections);
    const build = applySpellSeedPlans(
      {
        spellLibrary: { wizard: { 1: ["Shield"] } },
        spellSelections: { wizard: { prepared: { 1: ["Shield"] } } },
      } as unknown as CharacterBuild,
      plans,
    );

    expect(groups.map((group) => group.level)).toEqual([1]);
    expect(selectedSpellCount(groups, selections)).toBe(2);
    expect(plans).toEqual([
      {
        classKey: "wizard",
        level: 1,
        spells: ["Magic Missile", "Burning Hands"],
      },
    ]);
    expect(build.spellLibrary?.wizard?.[1]).toEqual([
      "Shield",
      "Magic Missile",
      "Burning Hands",
    ]);
    expect(build.spellSelections?.wizard?.prepared?.[1]).toEqual(["Shield"]);
  });
});
