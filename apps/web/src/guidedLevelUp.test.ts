import { describe, expect, it } from "vitest";
import {
  applyLevelUp,
  buildCharacter,
  computeSheet,
  type CharacterBuild,
  type LevelUpSelection,
} from "@mathfinder/rules-engine";
import { applyGuidedLevelUp, withLevelUpCastingChoices } from "./guidedLevelUp";
import { buildSpellbookGrantGroups } from "./spellSeedPlans";

function character(className: string): CharacterBuild {
  return {
    name: "Guide test",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 18, cha: 18 },
    levels: [{ className, hitPointRoll: 6 }],
    spellSelections: {
      [className.toLowerCase()]: {
        known: { 0: ["Detect Magic"], 1: ["Magic Missile"] },
        prepared: { 1: ["Bless"] },
      },
      wizard: { prepared: { 1: ["Shield"] } },
    },
    spellLibrary: {
      [className.toLowerCase()]: { 0: ["Detect Magic"], 1: ["Magic Missile"] },
    },
    languages: { starting: ["Draconic"] },
    coinPurse: { gp: 27, pp: 0, sp: 0, cp: 0 },
  };
}
function advance(
  build: CharacterBuild,
  spells: string[],
  className = build.levels[0]!.className,
) {
  const selection: LevelUpSelection = {
    className,
    hitPointRoll: 4,
    skillRanks: { spellcraft: 1 },
  };
  const casters = computeSheet(
    buildCharacter(applyLevelUp(build, selection)),
  ).spellcasting;
  const caster = casters.find((entry) => entry.className === className)!;
  return applyGuidedLevelUp(
    build,
    selection,
    [
      {
        classKey: className.toLowerCase(),
        level: 1,
        mode: caster.castingType === "prepared" ? "prepared" : "known",
        spells,
      },
    ],
    casters,
  );
}
describe("guided level-up commit", () => {
  it("requires exactly two new spellbook spells for an existing wizard level", () => {
    const build = character("Wizard");
    const selection = { className: "Wizard", hitPointRoll: 4, skillRanks: {} };
    const casters = computeSheet(
      buildCharacter(applyLevelUp(build, selection)),
    ).spellcasting;
    const names = buildSpellbookGrantGroups(casters[0]!, {})[0]!
      .suggestions.slice(0, 3)
      .map((spell) => spell.spellName);
    for (const spells of [
      [],
      names.slice(0, 1),
      names,
      [names[0]!, names[0]!],
      ["Magic Missile", names[0]!],
    ]) {
      expect(() =>
        applyGuidedLevelUp(
          build,
          selection,
          [{ classKey: "wizard", level: 1, mode: "library", spells }],
          casters,
        ),
      ).toThrow(/exactly two/);
    }
    const next = applyGuidedLevelUp(
      build,
      selection,
      [
        {
          classKey: "wizard",
          level: 1,
          mode: "library",
          spells: names.slice(0, 2),
        },
      ],
      casters,
    );
    expect(next.spellSelections).toEqual(build.spellSelections);
    expect(next.spellLibrary?.wizard?.[1]).toEqual([
      "Magic Missile",
      "Shield",
      ...names.slice(0, 2),
    ]);
  });
  it("accepts a starting wizard book when multiclassing and preserves favored details and unrelated state", () => {
    const build = character("Fighter");
    delete build.spellSelections?.wizard;
    const selection = {
      className: "Wizard",
      hitPointRoll: 4,
      skillRanks: {},
      favoredClass: "hp",
      favoredClassSelection: "saved detail",
    };
    const casters = computeSheet(
      buildCharacter(applyLevelUp(build, selection)),
    ).spellcasting;
    const names =
      casters[0]!.selectionDiagnostics[1]!.availableSpellNames.slice(0, 7);
    const next = applyGuidedLevelUp(
      build,
      selection,
      [{ classKey: "wizard", level: 1, mode: "library", spells: names }],
      casters,
    );
    expect(next.spellLibrary?.wizard?.[1]).toEqual(names);
    expect(next.levels[next.levels.length - 1]?.favoredClassSelection).toBe(
      "saved detail",
    );
    expect(next.coinPurse).toEqual(build.coinPurse);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });
  it("carries first-time cleric domains through projection and confirmation while ignoring other class edits", () => {
    const build = character("Fighter");
    build.spellDomains = { wizard: ["existing"] };
    const selection = { className: "Cleric", hitPointRoll: 5, skillRanks: {} };
    const choices = {
      spellDomains: { cleric: ["good", "healing"], wizard: ["changed"] },
    };
    const projected = withLevelUpCastingChoices(
      applyLevelUp(build, selection),
      selection.className,
      choices,
    );
    const casters = computeSheet(buildCharacter(projected)).spellcasting;
    const next = applyGuidedLevelUp(
      build,
      selection,
      [],
      casters,
      undefined,
      choices,
    );
    expect(next.spellDomains).toEqual({
      wizard: ["existing"],
      cleric: ["good", "healing"],
    });
    expect(next.spellDomains).toEqual(projected.spellDomains);
    expect(casters[0]!.librarySpells[1]).toContain("Bless");
  });
  it("adds known spells within capacity while retaining prior spells and other character data", () => {
    const build = character("Sorcerer");
    const original = structuredClone(build);
    const next = advance(build, ["magic missile", "Shield"]);
    expect(next.spellSelections?.sorcerer?.known?.[1]).toEqual([
      "Magic Missile",
      "Shield",
    ]);
    expect(next.spellSelections?.sorcerer?.known?.[0]).toEqual([
      "Detect Magic",
    ]);
    expect(next.spellSelections?.wizard).toEqual(build.spellSelections?.wizard);
    expect(next.spellLibrary?.sorcerer?.[1]).toEqual([
      "Magic Missile",
      "Shield",
    ]);
    expect(next.coinPurse).toEqual(build.coinPurse);
    expect(next.languages).toEqual(build.languages);
    expect(next.levels).toHaveLength(2);
    expect(next.levels[0]).toEqual(build.levels[0]);
    expect(build).toEqual(original);
  });
  it("retains repeated preparations and keeps full-list spells out of manual acquisition records", () => {
    const build = character("Cleric");
    const next = advance(build, ["Bless"]);
    expect(next.spellSelections?.cleric?.prepared?.[1]).toEqual([
      "Bless",
      "Bless",
    ]);
    expect(next.spellLibrary).toEqual(build.spellLibrary);
  });
  it("does not seed another class when advancing a multiclass character", () => {
    const build = character("Sorcerer");
    const selection = { className: "Fighter", hitPointRoll: 6, skillRanks: {} };
    const casters = computeSheet(
      buildCharacter(applyLevelUp(build, selection)),
    ).spellcasting;
    expect(() =>
      applyGuidedLevelUp(
        build,
        selection,
        [{ classKey: "sorcerer", level: 1, mode: "known", spells: ["Shield"] }],
        casters,
        { starting: ["Elven"] },
      ),
    ).toThrow(/advanced class/);
    const next = applyGuidedLevelUp(build, selection, [], casters, {
      starting: ["Elven"],
    });
    expect(next.spellSelections).toEqual(build.spellSelections);
    expect(next.spellLibrary).toEqual(build.spellLibrary);
    expect(next.languages?.starting).toEqual(["Elven"]);
  });
});
