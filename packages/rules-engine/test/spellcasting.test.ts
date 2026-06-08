import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { spellSaveDc, spellsByLevel } from "../src";

describe("spellcasting helpers", () => {
  it("computes spell save DCs from spell level and casting modifier", () => {
    expect(spellSaveDc(4, 0)).toBe(14);
    expect(spellSaveDc(4, 3)).toBe(17);
  });

  it("builds compact spells/day maps", () => {
    expect(spellsByLevel(3, 1)).toEqual({ 0: 3, 1: 1 });
  });
});

describe("wizard spellcasting", () => {
  it("derives caster level, concentration, save DCs, and spells/day", () => {
    const build: CharacterBuild = {
      name: "Merisiel But Nerdier",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting).toHaveLength(1);
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Wizard",
      castingType: "prepared",
      castingAbility: "int",
      casterLevel: 1,
      maxSpellLevel: 1,
      spellsPerDay: { 0: 3, 1: 1 },
      spellSaveDcs: { 0: 14, 1: 15 },
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });
});
