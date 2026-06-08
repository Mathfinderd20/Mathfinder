import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { bonusSpellSlots, spellSaveDc, spellsByLevel } from "../src";

describe("spellcasting helpers", () => {
  it("computes spell save DCs from spell level and casting modifier", () => {
    expect(spellSaveDc(4, 0)).toBe(14);
    expect(spellSaveDc(4, 3)).toBe(17);
  });

describe("cleric and sorcerer spellcasting", () => {
  it("derives cleric prepared casting with Wisdom bonus slots", () => {
    const build: CharacterBuild = {
      name: "Hammerbro Priest",
      race: { name: "Dwarf", size: "medium", speed: 20 },
      baseAbilityScores: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 8 },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Cleric",
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: { 0: 3, 1: 2 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
    });
  });

  it("derives sorcerer spontaneous casting with Charisma bonus slots", () => {
    const build: CharacterBuild = {
      name: "Hot Topic Dragonkid",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 },
      levels: [{ className: "Sorcerer", hitPointRoll: 6, feats: [] }],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Sorcerer",
      castingType: "spontaneous",
      castingAbility: "cha",
      baseSpellsPerDay: { 0: 5, 1: 3 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 5, 1: 4 },
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });
});

  it("computes bonus spell slots from casting modifier", () => {
    expect(bonusSpellSlots(4, 0)).toBe(0);
    expect(bonusSpellSlots(4, 1)).toBe(1);
    expect(bonusSpellSlots(4, 4)).toBe(1);
    expect(bonusSpellSlots(4, 5)).toBe(0);
    expect(bonusSpellSlots(5, 1)).toBe(2);
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
      baseSpellsPerDay: { 0: 3, 1: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 3, 1: 2 },
      spellSaveDcs: { 0: 14, 1: 15 },
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });
});
